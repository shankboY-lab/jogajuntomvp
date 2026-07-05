import { prisma } from "@/server/db";
import { ensureGames } from "@/server/bgg/client";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { findNearbyPlayers } from "@/server/search/geoQuery";
import { formatApproxDistance } from "@/server/geo/distance";
import { track } from "@/server/events/track";
import { intentTtlDays } from "@/server/matching/interests";
import { searchQuerySchema } from "@/shared/schemas";
import type { InterestState, SearchResponse, SearchResultItem } from "@/shared/types";

// BE-12 — GET /api/search?mode=A|B&bggId=&radius= (RF-16..20, RNF-04/07).
// Payload NUNCA contém contato nem coordenadas (teste de contrato em QA).

export const GET = withApi("search", async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const query = searchQuerySchema.parse({
    mode: url.searchParams.get("mode"),
    bggId: url.searchParams.get("bggId"),
    radius: url.searchParams.get("radius") ?? undefined,
  });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profile.completedAt) {
    return fail(409, "profile_incomplete", "Complete seu perfil para buscar jogadores.");
  }

  // modo A exige jogo na coleção e cria/renova intent implicitamente (v2-05:
  // tocar no chip já sinaliza "quero jogar")
  if (query.mode === "A") {
    const owned = await prisma.userGame.findUnique({
      where: { userId_bggId: { userId, bggId: query.bggId } },
    });
    if (!owned) {
      return fail(422, "game_not_in_collection", "Este jogo não está na sua coleção.");
    }
    const expiresAt = new Date(Date.now() + intentTtlDays() * 24 * 60 * 60 * 1000);
    await prisma.playIntent.upsert({
      where: { userId_bggId: { userId, bggId: query.bggId } },
      create: { userId, bggId: query.bggId, status: "ACTIVE", expiresAt },
      update: { status: "ACTIVE", expiresAt },
    });
  }

  const [game] = await ensureGames([query.bggId]);
  if (!game) return fail(404, "game_not_found", "Jogo não encontrado.");

  // radius opcional sobrepõe o do perfil SÓ nesta busca (v2-09 "Ampliar")
  const radiusKm = query.radius ?? profile.radiusKm;

  const candidates = await findNearbyPlayers({
    viewerId: userId,
    viewerLat: profile.lat,
    viewerLng: profile.lng,
    bggId: query.bggId,
    radiusKm,
  });

  const candidateIds = candidates.map((c) => c.userId);

  // estado do interesse por candidato (alimenta o botão "Convite enviado", v2-06)
  const [sentReqs, receivedReqs, matches, myGames] = await Promise.all([
    prisma.interestRequest.findMany({
      where: { fromUserId: userId, toUserId: { in: candidateIds }, bggId: query.bggId },
      select: { toUserId: true, status: true },
    }),
    prisma.interestRequest.findMany({
      where: {
        fromUserId: { in: candidateIds },
        toUserId: userId,
        bggId: query.bggId,
        status: "PENDING",
      },
      select: { fromUserId: true },
    }),
    prisma.match.findMany({
      where: {
        bggId: query.bggId,
        OR: [
          { userLoId: userId, userHiId: { in: candidateIds } },
          { userHiId: userId, userLoId: { in: candidateIds } },
        ],
      },
    }),
    prisma.userGame.findMany({ where: { userId }, select: { bggId: true } }),
  ]);

  const sentTo = new Map(sentReqs.map((r) => [r.toUserId, r.status]));
  const receivedFrom = new Set(receivedReqs.map((r) => r.fromUserId));
  const matchByUser = new Map(
    matches.map((m) => [m.userLoId === userId ? m.userHiId : m.userLoId, m.id]),
  );

  // nomes dos jogos em comum (até 3 por card — "Catan +2")
  const myGameIds = myGames.map((g) => g.bggId);
  const commonRows =
    candidateIds.length > 0 && myGameIds.length > 0
      ? await prisma.userGame.findMany({
          where: { userId: { in: candidateIds }, bggId: { in: myGameIds } },
          include: { game: { select: { name: true } } },
        })
      : [];
  const commonNames = new Map<string, string[]>();
  for (const row of commonRows) {
    const list = commonNames.get(row.userId) ?? [];
    if (list.length < 3) list.push(row.game.name);
    commonNames.set(row.userId, list);
  }

  const results: SearchResultItem[] = candidates.map((c) => {
    let interestState: InterestState = "none";
    let matchId: string | null = null;
    if (matchByUser.has(c.userId)) {
      interestState = "matched";
      matchId = matchByUser.get(c.userId)!;
    } else if (receivedFrom.has(c.userId)) {
      interestState = "received";
    } else if (sentTo.has(c.userId)) {
      // DECLINED também aparece como "sent" — sem notificação constrangedora (§9)
      interestState = "sent";
    }
    return {
      userId: c.userId,
      displayName: c.displayName,
      photoUrl: c.photoUrl,
      approxDistance: formatApproxDistance(c.distanceKm),
      commonGames: commonNames.get(c.userId) ?? [],
      commonGamesCount: c.commonGamesCount,
      interestState,
      matchId,
    };
  });

  await track("search_performed", userId, { mode: query.mode, bggId: query.bggId, radiusKm });
  if (results.length === 0) {
    await track("search_zero_results", userId, { mode: query.mode, bggId: query.bggId, radiusKm });
  }

  const response: SearchResponse = { game, radiusKm, total: results.length, results };
  return ok(response);
});
