import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { haversineKm, formatApproxDistance } from "@/server/geo/distance";
import type { InboxResponse, InboxRequestItem, InboxMatchItem, GameSummary } from "@/shared/types";

// BE-14 — GET /api/inbox: recebidos, enviados, matches (RF-23).
// Distância aproximada calculada e formatada no servidor; contato NUNCA aqui (RNF-09).

export const GET = withApi("inbox", async () => {
  const { userId } = await requireUser();

  const myProfile = await prisma.profile.findUnique({ where: { userId } });

  const [received, sent, matches] = await Promise.all([
    prisma.interestRequest.findMany({
      where: { toUserId: userId, status: "PENDING" },
      include: { fromUser: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interestRequest.findMany({
      where: { fromUserId: userId, status: "PENDING" },
      include: { toUser: { include: { profile: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findMany({
      where: { OR: [{ userLoId: userId }, { userHiId: userId }] },
      include: {
        userLo: { include: { profile: true } },
        userHi: { include: { profile: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const gameIds = [
    ...new Set([
      ...received.map((r) => r.bggId),
      ...sent.map((r) => r.bggId),
      ...matches.map((m) => m.bggId),
    ]),
  ];
  const games = await prisma.game.findMany({ where: { bggId: { in: gameIds } } });
  const gameById = new Map<number, GameSummary>(
    games.map((g) => [
      g.bggId,
      {
        bggId: g.bggId,
        name: g.name,
        yearPublished: g.yearPublished,
        thumbnailUrl: g.thumbnailUrl,
      },
    ]),
  );
  const fallbackGame = (bggId: number): GameSummary =>
    gameById.get(bggId) ?? {
      bggId,
      name: `Jogo #${bggId}`,
      yearPublished: null,
      thumbnailUrl: null,
    };

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
    game: fallbackGame(r.bggId),
    approxDistance: distanceTo(r.fromUser.profile?.lat, r.fromUser.profile?.lng),
    createdAt: r.createdAt.toISOString(),
  }));

  const sentItems: InboxRequestItem[] = sent.map((r) => ({
    id: r.id,
    user: toUserSummary(r.toUser),
    game: fallbackGame(r.bggId),
    approxDistance: distanceTo(r.toUser.profile?.lat, r.toUser.profile?.lng),
    createdAt: r.createdAt.toISOString(),
  }));

  const matchItems: InboxMatchItem[] = matches.map((m) => {
    const partner = m.userLoId === userId ? m.userHi : m.userLo;
    return {
      matchId: m.id,
      user: toUserSummary(partner),
      game: fallbackGame(m.bggId),
      approxDistance: distanceTo(partner.profile?.lat, partner.profile?.lng),
      createdAt: m.createdAt.toISOString(),
    };
  });

  const response: InboxResponse = {
    received: receivedItems,
    sent: sentItems,
    matches: matchItems,
    counts: { received: receivedItems.length, matches: matchItems.length },
  };
  return ok(response);
});
