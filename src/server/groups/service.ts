import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { track } from "@/server/events/track";
import { createMatchIdempotent, trackManualGameMatch } from "@/server/matching/interests";
import { toGameSummary } from "@/server/games/catalog";
import { haversineKm, formatApproxDistance } from "@/server/geo/distance";
import type { GroupCreateInput } from "@/shared/schemas";
import type { GroupDetailResponse, GroupRequestState } from "@/shared/types";

// BE-24/25/26 — módulo de domínio de grupos (RF-41..51). Vagas transacionais
// (RNF-14) e "match" continua sendo a única porta para contato (RF-44).

const MAX_OPEN_PER_CREATOR = 3; // RF-50

export function groupTtlDays(): number {
  const raw = Number(process.env.GROUP_TTL_DAYS);
  return Number.isFinite(raw) && raw > 0 ? raw : 14;
}

type Tx = Prisma.TransactionClient;

async function notify(
  tx: Tx,
  userId: string,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await tx.notification.create({
    data: { userId, type, payload: payload as Prisma.InputJsonValue },
  });
}

/** POST /api/groups — cria grupo (jogo na coleção, máx 3 abertos). */
export async function createGroup(creatorId: string, input: GroupCreateInput) {
  const owned = await prisma.userGame.findUnique({
    where: { userId_gameId: { userId: creatorId, gameId: input.gameId } },
  });
  if (!owned) {
    throw new ApiError(
      422,
      "game_not_in_collection",
      "Você precisa ter o jogo na sua coleção para criar um grupo.",
    );
  }

  const openCount = await prisma.group.count({ where: { creatorId, status: "OPEN" } });
  if (openCount >= MAX_OPEN_PER_CREATOR) {
    throw new ApiError(
      409,
      "too_many_open_groups",
      "Você já tem 3 grupos abertos. Feche ou cancele um antes de criar outro.",
    );
  }

  const expiresAt = new Date(Date.now() + groupTtlDays() * 24 * 60 * 60 * 1000);
  const group = await prisma.group.create({
    data: {
      creatorId,
      gameId: input.gameId,
      name: input.name,
      slots: input.slots,
      expiresAt,
    },
  });

  await track("grupo_criado", creatorId, {
    groupId: group.id,
    gameId: input.gameId,
    slots: input.slots,
  });
  return group;
}

/** GET /api/groups/:id — detalhe com shape por papel (criador/membro/visitante). */
export async function getGroupDetail(
  groupId: string,
  viewerId: string,
): Promise<GroupDetailResponse> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      game: true,
      creator: { include: { profile: true } },
      members: { include: { user: { include: { profile: true } } } },
      requests: {
        where: { status: "PENDING" },
        include: { fromUser: { include: { profile: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!group) throw new ApiError(404, "group_not_found", "Grupo não encontrado.");

  const isCreator = group.creatorId === viewerId;
  const myMember = group.members.find((m) => m.userId === viewerId);

  let myRequestState: GroupRequestState = "none";
  let myMatchId: string | null = null;
  if (myMember) {
    myRequestState = "member";
    myMatchId = myMember.matchId;
  } else if (!isCreator) {
    const myReq = await prisma.groupJoinRequest.findUnique({
      where: { groupId_fromUserId: { groupId, fromUserId: viewerId } },
    });
    if (myReq) {
      myRequestState =
        myReq.status === "PENDING"
          ? "pending"
          : myReq.status === "ACCEPTED"
            ? "accepted"
            : "declined";
    }
  }

  // distância exibida é SEMPRE a do criador (RNF-15)
  const creatorProfile = group.creator.profile;
  const viewerProfile = await prisma.profile.findUnique({ where: { userId: viewerId } });
  const approxDistance =
    creatorProfile && viewerProfile
      ? formatApproxDistance(
          haversineKm(viewerProfile.lat, viewerProfile.lng, creatorProfile.lat, creatorProfile.lng),
        )
      : "";

  const response: GroupDetailResponse = {
    groupId: group.id,
    name: group.name,
    game: toGameSummary(group.game),
    creator: {
      userId: group.creatorId,
      displayName: creatorProfile?.displayName ?? "Jogador(a)",
      photoUrl: creatorProfile?.photoUrl ?? null,
    },
    slotsTotal: group.slots,
    slotsFilled: group.members.length,
    status: group.status,
    expiresAt: group.expiresAt.toISOString(),
    approxDistance,
    isCreator,
    myRequestState,
    myMatchId,
  };

  // só o criador enxerga pedidos e a lista de membros (D4/RNF-15)
  if (isCreator) {
    response.requests = group.requests.map((r) => ({
      requestId: r.id,
      user: {
        userId: r.fromUserId,
        displayName: r.fromUser.profile?.displayName ?? "Jogador(a)",
        photoUrl: r.fromUser.profile?.photoUrl ?? null,
      },
      createdAt: r.createdAt.toISOString(),
    }));
    response.members = group.members.map((m) => ({
      userId: m.userId,
      displayName: m.user.profile?.displayName ?? "Jogador(a)",
      photoUrl: m.user.profile?.photoUrl ?? null,
      matchId: m.matchId,
    }));
  }

  return response;
}

/** DELETE /api/groups/:id — cancela (só criador); notifica membros. */
export async function cancelGroup(groupId: string, userId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: { select: { userId: true } } },
  });
  if (!group) throw new ApiError(404, "group_not_found", "Grupo não encontrado.");
  if (group.creatorId !== userId)
    throw new ApiError(403, "not_creator", "Só o criador pode cancelar o grupo.");
  if (group.status === "CANCELLED") return;

  await prisma.$transaction(async (tx) => {
    await tx.group.update({ where: { id: groupId }, data: { status: "CANCELLED" } });
    await tx.groupJoinRequest.updateMany({
      where: { groupId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    for (const m of group.members) {
      await notify(tx, m.userId, "group_cancelled", {
        groupId,
        groupName: group.name,
        gameId: group.gameId,
      });
    }
  });

  await track("grupo_cancelado", userId, { groupId });
}

/** POST /api/groups/:id/requests — pedido de entrada (idempotente por unique). */
export async function requestJoin(groupId: string, fromUserId: string): Promise<void> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiError(404, "group_not_found", "Grupo não encontrado.");
  if (group.status !== "OPEN" || group.expiresAt <= new Date()) {
    throw new ApiError(409, "group_not_open", "Este grupo não está mais aberto para pedidos.");
  }
  if (group.creatorId === fromUserId) {
    throw new ApiError(422, "cannot_join_own_group", "Você é o criador deste grupo.");
  }

  const existing = await prisma.groupJoinRequest.findUnique({
    where: { groupId_fromUserId: { groupId, fromUserId } },
  });
  if (existing) {
    if (existing.status === "PENDING" || existing.status === "ACCEPTED") {
      throw new ApiError(409, "already_requested", "Você já pediu para entrar neste grupo.");
    }
    // DECLINED/AUTO_DECLINED/CANCELLED → reabre o pedido (vaga pode ter voltado)
    await prisma.groupJoinRequest.update({
      where: { id: existing.id },
      data: { status: "PENDING", createdAt: new Date() },
    });
  } else {
    await prisma.groupJoinRequest.create({ data: { groupId, fromUserId } });
  }

  await track("pedido_entrada_enviado", fromUserId, { groupId });
}

export type RespondResult =
  { outcome: "declined" } | { outcome: "accepted"; matchId: string; becameFull: boolean };

/** PATCH /api/groups/:id/requests/:reqId — aceite transacional / recusa. */
export async function respondToJoinRequest(
  groupId: string,
  reqId: string,
  creatorId: string,
  action: "accept" | "decline",
): Promise<RespondResult> {
  const req = await prisma.groupJoinRequest.findUnique({
    where: { id: reqId },
    include: { group: true },
  });
  if (!req || req.groupId !== groupId) {
    throw new ApiError(404, "request_not_found", "Pedido não encontrado.");
  }
  if (req.group.creatorId !== creatorId) {
    throw new ApiError(403, "not_creator", "Só o criador do grupo responde os pedidos.");
  }
  if (req.status !== "PENDING") {
    throw new ApiError(409, "request_not_pending", "Este pedido já foi respondido.");
  }

  if (action === "decline") {
    await prisma.groupJoinRequest.update({ where: { id: reqId }, data: { status: "DECLINED" } });
    await track("pedido_recusado", creatorId, { groupId, requestId: reqId });
    return { outcome: "declined" };
  }

  // accept — transação SERIALIZABLE + lock do grupo + re-check de vagas (RNF-14)
  const run = () =>
    prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM groups WHERE id = ${groupId} FOR UPDATE`;
        const group = await tx.group.findUnique({
          where: { id: groupId },
          include: { _count: { select: { members: true } } },
        });
        if (!group) throw new ApiError(404, "group_not_found", "Grupo não encontrado.");
        if (group.status !== "OPEN") {
          throw new ApiError(409, "group_full", "Este grupo não está mais aberto.");
        }
        const filled = group._count.members;
        if (filled >= group.slots) {
          throw new ApiError(409, "group_full", "As vagas deste grupo acabaram de encher.");
        }
        const fresh = await tx.groupJoinRequest.findUnique({ where: { id: reqId } });
        if (!fresh || fresh.status !== "PENDING") {
          throw new ApiError(409, "request_not_pending", "Este pedido já foi respondido.");
        }

        // RF-44 — match criador↔membro (idempotente); é a porta para o contato
        const matchId = await createMatchIdempotent(
          tx,
          group.creatorId,
          fresh.fromUserId,
          group.gameId,
        );
        await tx.groupMember.create({ data: { groupId, userId: fresh.fromUserId, matchId } });
        await tx.groupJoinRequest.update({ where: { id: reqId }, data: { status: "ACCEPTED" } });

        let becameFull = false;
        if (filled + 1 >= group.slots) {
          becameFull = true;
          await tx.group.update({ where: { id: groupId }, data: { status: "FULL" } });
          // RF-46 — auto-recusa neutra dos pedidos remanescentes
          await tx.groupJoinRequest.updateMany({
            where: { groupId, status: "PENDING" },
            data: { status: "AUTO_DECLINED" },
          });
          // RF-45 — notifica criador + todos os membros
          const members = await tx.groupMember.findMany({
            where: { groupId },
            select: { userId: true },
          });
          const recipients = new Set<string>([group.creatorId, ...members.map((m) => m.userId)]);
          for (const uid of recipients) {
            await notify(tx, uid, "group_full", {
              groupId,
              groupName: group.name,
              gameId: group.gameId,
            });
          }
        }

        return { matchId, becameFull, memberId: fresh.fromUserId, slots: group.slots };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  let result: Awaited<ReturnType<typeof run>>;
  try {
    result = await run();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      result = await run();
    } else {
      throw err;
    }
  }

  await track("pedido_aceito", creatorId, { groupId, memberId: result.memberId });
  await trackManualGameMatch(creatorId, req.group.gameId);
  if (result.becameFull) {
    await track("grupo_completo", creatorId, { groupId, slots: result.slots });
  }
  return { outcome: "accepted", matchId: result.matchId, becameFull: result.becameFull };
}

/** DELETE /api/groups/:id/members/:userId — sair (self) ou remover (criador). */
export async function leaveOrRemoveMember(
  groupId: string,
  targetUserId: string,
  actingUserId: string,
): Promise<void> {
  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) throw new ApiError(404, "group_not_found", "Grupo não encontrado.");

  const isSelf = targetUserId === actingUserId;
  const isCreatorActing = group.creatorId === actingUserId;
  if (!isSelf && !isCreatorActing) {
    throw new ApiError(403, "forbidden", "Você não pode remover este membro.");
  }

  const member = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId: targetUserId } },
  });
  if (!member) throw new ApiError(404, "not_a_member", "Essa pessoa não é membro do grupo.");

  await prisma.$transaction(async (tx) => {
    // o Match PERMANECE (contato já foi liberado — PRD §9)
    await tx.groupMember.delete({ where: { groupId_userId: { groupId, userId: targetUserId } } });

    // reabre a vaga se estava cheio e não expirado (RF-47)
    if (group.status === "FULL" && group.expiresAt > new Date()) {
      await tx.group.update({ where: { id: groupId }, data: { status: "OPEN" } });
    }

    const remaining = await tx.groupMember.findMany({
      where: { groupId },
      select: { userId: true },
    });
    const type = isSelf ? "member_left" : "member_removed";
    // sair → avisa criador + demais membros; remover → avisa o removido + demais
    const recipients = new Set<string>(
      isSelf
        ? [group.creatorId, ...remaining.map((r) => r.userId)]
        : [targetUserId, ...remaining.map((r) => r.userId)],
    );
    recipients.delete(actingUserId);
    for (const uid of recipients) {
      await notify(tx, uid, type, {
        groupId,
        groupName: group.name,
        gameId: group.gameId,
        userId: targetUserId,
      });
    }
  });

  await track(isSelf ? "membro_saiu" : "membro_removido", actingUserId, { groupId, targetUserId });
}
