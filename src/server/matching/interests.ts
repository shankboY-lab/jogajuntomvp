import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { track } from "@/server/events/track";

// BE-13 — interesse + formação de match (RF-22/23/24).
// Aceite recíproco = match imediato; corrida A→B/B→A resolvida por transação
// serializable + unique (user_lo_id, user_hi_id, bgg_id) com user_lo < user_hi.

const MAX_PENDING_SENT = 10; // anti-spam (premissa §9)

export function intentTtlDays(): number {
  return Number(process.env.INTENT_TTL_DAYS ?? 7);
}

function orderPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/**
 * BE-28 — evento de funil quando um match se forma sobre um jogo cadastrado
 * manualmente (RF-35, guarda-corpo F1: mede se jogos da comunidade viram partida).
 */
export async function trackManualGameMatch(userId: string, gameId: string): Promise<void> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, select: { source: true } });
  if (game?.source === "USER_CREATED") {
    await track("jogo_manual_em_match", userId, { gameId });
  }
}

export type SendInterestResult =
  { outcome: "pending"; requestId: string } | { outcome: "matched"; matchId: string };

/**
 * Cria (ou reaproveita) o Match do par no jogo, dentro de uma transação.
 * Idempotente via unique (user_lo,user_hi,game). Reutilizado pelo aceite de
 * grupo (RF-44) — "match" segue sendo a única porta para o contato.
 */
export async function createMatchIdempotent(
  tx: Prisma.TransactionClient,
  userA: string,
  userB: string,
  gameId: string,
): Promise<string> {
  const [userLoId, userHiId] = orderPair(userA, userB);
  // Verifica ANTES de inserir: um INSERT que viola unique aborta a transação
  // inteira no Postgres (25P02), inutilizando o catch dentro do mesmo `tx`.
  // O par (criador↔membro) pode já ter match de outro grupo/convite (idempotência).
  const existing = await tx.match.findUnique({
    where: { userLoId_userHiId_gameId: { userLoId, userHiId, gameId } },
  });
  if (existing) return existing.id;
  const match = await tx.match.create({ data: { userLoId, userHiId, gameId } });
  return match.id;
}

/** POST /api/interests — envia pedido; recíproco → match imediato. */
export async function sendInterest(input: {
  fromUserId: string;
  toUserId: string;
  gameId: string;
}): Promise<SendInterestResult> {
  const { fromUserId, toUserId, gameId } = input;
  if (fromUserId === toUserId) {
    throw new ApiError(422, "self_interest", "Você não pode enviar convite para si mesmo.");
  }

  const run = async (): Promise<SendInterestResult> =>
    prisma.$transaction(
      async (tx) => {
        // (1) destinatário precisa de intent ativo no jogo
        const targetIntent = await tx.playIntent.findUnique({
          where: { userId_gameId: { userId: toUserId, gameId } },
        });
        if (
          !targetIntent ||
          targetIntent.status !== "ACTIVE" ||
          targetIntent.expiresAt <= new Date()
        ) {
          throw new ApiError(
            409,
            "target_not_available",
            "Essa pessoa não está mais procurando este jogo.",
          );
        }

        // remetente também sinaliza "quero jogar" (renova/cria o próprio intent)
        const expiresAt = new Date(Date.now() + intentTtlDays() * 24 * 60 * 60 * 1000);
        await tx.playIntent.upsert({
          where: { userId_gameId: { userId: fromUserId, gameId } },
          create: { userId: fromUserId, gameId, status: "ACTIVE", expiresAt },
          update: { status: "ACTIVE", expiresAt },
        });

        // reenvio → no-op (idempotência RF-22)
        const existing = await tx.interestRequest.findUnique({
          where: { fromUserId_toUserId_gameId: { fromUserId, toUserId, gameId } },
        });
        if (existing) {
          if (existing.status === "ACCEPTED") {
            const [lo, hi] = orderPair(fromUserId, toUserId);
            const match = await tx.match.findUnique({
              where: { userLoId_userHiId_gameId: { userLoId: lo, userHiId: hi, gameId } },
            });
            if (match) return { outcome: "matched" as const, matchId: match.id };
          }
          // PENDING/DECLINED/EXPIRED → remetente vê "enviado" (sem constrangimento, §9)
          return { outcome: "pending" as const, requestId: existing.id };
        }

        // anti-spam: máx 10 pedidos PENDING por usuário (premissa)
        const pendingCount = await tx.interestRequest.count({
          where: { fromUserId, status: "PENDING" },
        });
        if (pendingCount >= MAX_PENDING_SENT) {
          throw new ApiError(
            429,
            "too_many_pending",
            "Você tem convites demais aguardando resposta.",
          );
        }

        // (2) pedido inverso PENDING → aceite recíproco = match imediato
        const inverse = await tx.interestRequest.findUnique({
          where: {
            fromUserId_toUserId_gameId: { fromUserId: toUserId, toUserId: fromUserId, gameId },
          },
        });
        if (inverse && inverse.status === "PENDING") {
          await tx.interestRequest.update({
            where: { id: inverse.id },
            data: { status: "ACCEPTED" },
          });
          const matchId = await createMatchIdempotent(tx, fromUserId, toUserId, gameId);
          return { outcome: "matched" as const, matchId };
        }

        // (3) senão cria PENDING
        const request = await tx.interestRequest.create({
          data: { fromUserId, toUserId, gameId },
        });
        return { outcome: "pending" as const, requestId: request.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  let result: SendInterestResult;
  try {
    result = await run();
  } catch (err) {
    // conflito de serialização (dois envios simultâneos) → uma retentativa
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
      result = await run();
    } else {
      throw err;
    }
  }

  if (result.outcome === "matched") {
    await track("match_created", fromUserId, { gameId, matchId: result.matchId });
    await trackManualGameMatch(fromUserId, gameId);
  } else {
    await track("interest_sent", fromUserId, { gameId });
  }
  return result;
}

export type RespondResult = { outcome: "declined" } | { outcome: "matched"; matchId: string };

/** PATCH /api/interests/:id — só o destinatário aceita/recusa (RF-23). */
export async function respondToInterest(input: {
  requestId: string;
  userId: string;
  action: "accept" | "decline";
}): Promise<RespondResult> {
  const { requestId, userId, action } = input;

  const result = await prisma.$transaction(
    async (tx) => {
      const request = await tx.interestRequest.findUnique({ where: { id: requestId } });
      if (!request || request.toUserId !== userId) {
        throw new ApiError(404, "request_not_found", "Convite não encontrado.");
      }
      if (request.status !== "PENDING") {
        if (request.status === "ACCEPTED") {
          const [lo, hi] = orderPair(request.fromUserId, request.toUserId);
          const match = await tx.match.findUnique({
            where: {
              userLoId_userHiId_gameId: { userLoId: lo, userHiId: hi, gameId: request.gameId },
            },
          });
          if (match) return { outcome: "matched" as const, matchId: match.id };
        }
        throw new ApiError(409, "request_not_pending", "Este convite já foi respondido.");
      }

      if (action === "decline") {
        await tx.interestRequest.update({
          where: { id: request.id },
          data: { status: "DECLINED" },
        });
        return { outcome: "declined" as const };
      }

      await tx.interestRequest.update({
        where: { id: request.id },
        data: { status: "ACCEPTED" },
      });
      const matchId = await createMatchIdempotent(
        tx,
        request.fromUserId,
        request.toUserId,
        request.gameId,
      );
      return { outcome: "matched" as const, matchId };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  if (result.outcome === "matched") {
    await track("match_created", userId, { requestId, matchId: result.matchId });
    const req = await prisma.interestRequest.findUnique({
      where: { id: requestId },
      select: { gameId: true },
    });
    if (req) await trackManualGameMatch(userId, req.gameId);
  } else {
    await track("interest_declined", userId, { requestId });
  }
  return result;
}
