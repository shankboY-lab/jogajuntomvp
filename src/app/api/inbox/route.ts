import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { haversineKm, formatApproxDistance } from "@/server/geo/distance";
import { toGameSummary } from "@/server/games/catalog";
import { isFeatureEnabled } from "@/shared/flags";
import type {
  InboxResponse,
  InboxRequestItem,
  InboxMatchItem,
  InboxGroupRequestReceived,
  InboxGroupRequestSent,
  InboxNotification,
  GroupRequestState,
} from "@/shared/types";

// BE-14 — GET /api/inbox: recebidos, enviados, matches (RF-23).
// Distância aproximada calculada e formatada no servidor; contato NUNCA aqui (RNF-09).

export const GET = withApi("inbox", async () => {
  const { userId } = await requireUser();

  const myProfile = await prisma.profile.findUnique({ where: { userId } });

  const [received, sent, matches] = await Promise.all([
    prisma.interestRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { fromUser: { include: { profile: true } }, game: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interestRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      include: { toUser: { include: { profile: true } }, game: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findMany({
      where: { OR: [{ userLoId: userId }, { userHiId: userId }] },
      include: {
        userLo: { include: { profile: true } },
        userHi: { include: { profile: true } },
        game: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const distanceTo = (lat?: number | null, lng?: number | null): string => {
    if (!myProfile || lat == null || lng == null) return "";
    return formatApproxDistance(haversineKm(myProfile.lat, myProfile.lng, lat, lng));
  };

  type UserWithProfile = {
    id: string;
    profile: { displayName: string; photoUrl: string | null; lat: number; lng: number } | null;
  };
  const toUserSummary = (u: UserWithProfile) => ({
    userId: u.id,
    displayName: u.profile?.displayName ?? "Jogador(a)",
    photoUrl: u.profile?.photoUrl ?? null,
  });

  const receivedItems: InboxRequestItem[] = received.map((r) => ({
    id: r.id,
    user: toUserSummary(r.fromUser),
    game: toGameSummary(r.game),
    approxDistance: distanceTo(r.fromUser.profile?.lat, r.fromUser.profile?.lng),
    createdAt: r.createdAt.toISOString(),
  }));

  const sentItems: InboxRequestItem[] = sent.map((r) => ({
    id: r.id,
    user: toUserSummary(r.toUser),
    game: toGameSummary(r.game),
    approxDistance: distanceTo(r.toUser.profile?.lat, r.toUser.profile?.lng),
    createdAt: r.createdAt.toISOString(),
  }));

  const matchItems: InboxMatchItem[] = matches.map((m) => {
    const partner = m.userLoId === userId ? m.userHi : m.userLo;
    return {
      matchId: m.id,
      user: toUserSummary(partner),
      game: toGameSummary(m.game),
      approxDistance: distanceTo(partner.profile?.lat, partner.profile?.lng),
      createdAt: m.createdAt.toISOString(),
    };
  });

  // BE-27 — seções de grupo + notificações (só com a flag; v2 fica intacto)
  let groupReceived: InboxGroupRequestReceived[] = [];
  let groupSent: InboxGroupRequestSent[] = [];
  let notifItems: InboxNotification[] = [];

  if (isFeatureEnabled("groups")) {
    const [received, sent, notifs] = await Promise.all([
      prisma.groupJoinRequest.findMany({
        where: { status: "PENDING", group: { creatorId: userId } },
        include: {
          fromUser: { include: { profile: true } },
          group: { include: { game: true, _count: { select: { members: true } } } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.groupJoinRequest.findMany({
        where: { fromUserId: userId, status: { in: ["PENDING", "ACCEPTED"] } },
        include: { group: { include: { game: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.notification.findMany({
        where: { userId, readAt: null },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    groupReceived = received.map((r) => ({
      requestId: r.id,
      groupId: r.groupId,
      groupName: r.group.name,
      game: toGameSummary(r.group.game),
      user: toUserSummary(r.fromUser),
      slotsTotal: r.group.slots,
      slotsFilled: r.group._count.members,
      createdAt: r.createdAt.toISOString(),
    }));
    groupSent = sent.map((r) => ({
      requestId: r.id,
      groupId: r.groupId,
      groupName: r.group.name,
      game: toGameSummary(r.group.game),
      state: (r.status === "PENDING" ? "pending" : "accepted") as GroupRequestState,
      createdAt: r.createdAt.toISOString(),
    }));
    notifItems = notifs.map((n) => ({
      id: n.id,
      type: n.type,
      payload: n.payload as Record<string, unknown>,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  const badge = receivedItems.length + groupReceived.length + notifItems.length;
  const response: InboxResponse = {
    received: receivedItems,
    sent: sentItems,
    matches: matchItems,
    groupRequests: { received: groupReceived, sent: groupSent },
    notifications: notifItems,
    counts: {
      received: receivedItems.length,
      matches: matchItems.length,
      groupRequests: groupReceived.length,
      notifications: notifItems.length,
      badge,
    },
  };
  return ok(response);
});
