import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser, requireFeature } from "@/server/http";
import { resolveGameId, toGameSummary } from "@/server/games/catalog";
import { findNearbyPlayers, findExplorePlayers } from "@/server/search/geoQuery";
import { findOpenGroups, getMyGroupStates } from "@/server/groups/searchGroups";
import { formatApproxDistance } from "@/server/geo/distance";
import { track } from "@/server/events/track";
import { intentTtlDays } from "@/server/matching/interests";
import { isFeatureEnabled } from "@/shared/flags";
import { searchQuerySchema, exploreQuerySchema } from "@/shared/schemas";
import type {
  ExploreEntry,
  ExploreResponse,
  GroupResultItem,
  InterestState,
  SearchResponse,
  SearchResultEntry,
  SearchResultItem,
} from "@/shared/types";

// helper compartilhado A/B/C — grupos abertos como entradas ordenáveis por dist.
async function groupEntries(
  viewerId: string,
  viewerLat: number,
  viewerLng: number,
  radiusKm: number,
  gameId: string | undefined,
): Promise<{ dist: number; entry: GroupResultItem }[]> {
  if (!isFeatureEnabled("groups")) return [];
  const groups = await findOpenGroups({
    viewerId,
    viewerLat,
    viewerLng,
    radiusKm,
    gameId,
    limit: 20,
  });
  const states = await getMyGroupStates(
    viewerId,
    groups.map((g) => g.groupId),
  );
  return groups.map((g) => ({
    dist: g.distanceKm,
    entry: {
      type: "group",
      groupId: g.groupId,
      name: g.name,
      game: { gameId: g.gameId, name: g.gameName, thumbnailUrl: g.thumbnailUrl },
      creator: { displayName: g.creatorName, photoUrl: g.creatorPhoto },
      slotsTotal: g.slotsTotal,
      slotsFilled: g.slotsFilled,
      approxDistance: formatApproxDistance(g.distanceKm),
      myRequestState: states.get(g.groupId) ?? "none",
    },
  }));
}

const EXPLORE_PAGE_SIZE = 20; // RNF-13

// BE-12 — GET /api/search?mode=A|B&gameId=&radius= (RF-16..20, RNF-04/07).
// BE-22 — GET /api/search?mode=C&radius=&page= (RF-37/38, RNF-13, explorar).
// `gameId` aceita id interno (cuid) ou bggId numérico legado (compat /busca).
// Payload NUNCA contém contato nem coordenadas (teste de contrato em QA).

export const GET = withApi("search", async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);

  if (url.searchParams.get("mode") === "C") {
    return handleExplore(userId, url);
  }

  const query = searchQuerySchema.parse({
    mode: url.searchParams.get("mode"),
    gameId: url.searchParams.get("gameId"),
    radius: url.searchParams.get("radius") ?? undefined,
  });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profile.completedAt) {
    return fail(409, "profile_incomplete", "Complete seu perfil para buscar jogadores.");
  }

  // resolve a referência pública p/ o id interno canônico (materializa BGG se preciso)
  const gameId = await resolveGameId(query.gameId);
  if (!gameId) return fail(404, "game_not_found", "Jogo não encontrado.");
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return fail(404, "game_not_found", "Jogo não encontrado.");

  // modo A exige jogo na coleção e cria/renova intent implicitamente (v2-05:
  // tocar no chip já sinaliza "quero jogar")
  if (query.mode === "A") {
    const owned = await prisma.userGame.findUnique({
      where: { userId_gameId: { userId, gameId } },
    });
    if (!owned) {
      return fail(422, "game_not_in_collection", "Este jogo não está na sua coleção.");
    }
    const expiresAt = new Date(Date.now() + intentTtlDays() * 24 * 60 * 60 * 1000);
    await prisma.playIntent.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId, status: "ACTIVE", expiresAt },
      update: { status: "ACTIVE", expiresAt },
    });
  }

  // radius opcional sobrepõe o do perfil SÓ nesta busca (v2-09 "Ampliar")
  const radiusKm = query.radius ?? profile.radiusKm;

  const candidates = await findNearbyPlayers({
    viewerId: userId,
    viewerLat: profile.lat,
    viewerLng: profile.lng,
    gameId,
    radiusKm,
  });

  const candidateIds = candidates.map((c) => c.userId);

  // estado do interesse por candidato (alimenta o botão "Convite enviado", v2-06)
  const [sentReqs, receivedReqs, matches, myGames] = await Promise.all([
    prisma.interestRequest.findMany({
      where: { fromUserId: userId, toUserId: { in: candidateIds }, gameId },
      select: { toUserId: true, status: true },
    }),
    prisma.interestRequest.findMany({
      where: {
        fromUserId: { in: candidateIds },
        toUserId: userId,
        gameId,
        status: "PENDING",
      },
      select: { fromUserId: true },
    }),
    prisma.match.findMany({
      where: {
        gameId,
        OR: [
          { userLoId: userId, userHiId: { in: candidateIds } },
          { userHiId: userId, userLoId: { in: candidateIds } },
        ],
      },
    }),
    prisma.userGame.findMany({ where: { userId }, select: { gameId: true } }),
  ]);

  const sentTo = new Map(sentReqs.map((r) => [r.toUserId, r.status]));
  const receivedFrom = new Set(receivedReqs.map((r) => r.fromUserId));
  const matchByUser = new Map(
    matches.map((m) => [m.userLoId === userId ? m.userHiId : m.userLoId, m.id]),
  );

  // nomes dos jogos em comum (até 3 por card — "Catan +2")
  const myGameIds = myGames.map((g) => g.gameId);
  const commonRows =
    candidateIds.length > 0 && myGameIds.length > 0
      ? await prisma.userGame.findMany({
          where: { userId: { in: candidateIds }, gameId: { in: myGameIds } },
          include: { game: { select: { name: true } } },
        })
      : [];
  const commonNames = new Map<string, string[]>();
  for (const row of commonRows) {
    const list = commonNames.get(row.userId) ?? [];
    if (list.length < 3) list.push(row.game.name);
    commonNames.set(row.userId, list);
  }

  const peopleEntries = candidates.map((c) => {
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
    const item: SearchResultItem = {
      userId: c.userId,
      displayName: c.displayName,
      photoUrl: c.photoUrl,
      approxDistance: formatApproxDistance(c.distanceKm),
      commonGames: commonNames.get(c.userId) ?? [],
      commonGamesCount: c.commonGamesCount,
      interestState,
      matchId,
    };
    return { dist: c.distanceKm, entry: item as SearchResultEntry };
  });

  // RF-42 — grupos abertos do jogo entram nos resultados, ordenados por distância
  const groups = await groupEntries(userId, profile.lat, profile.lng, radiusKm, gameId);
  const results = [...peopleEntries, ...groups].sort((a, b) => a.dist - b.dist).map((e) => e.entry);

  await track("search_performed", userId, { mode: query.mode, gameId, radiusKm });
  if (results.length === 0) {
    await track("search_zero_results", userId, { mode: query.mode, gameId, radiusKm });
  }
  if (groups.length > 0) {
    await track("grupo_exibido_em_busca", userId, { count: groups.length, gameId });
  }

  const response: SearchResponse = {
    game: toGameSummary(game),
    radiusKm,
    total: results.length,
    results,
  };
  return ok(response);
});

// BE-22 — modo C "explorar": pessoas com >=1 intent ativa, sem filtro de jogo,
// paginado (RNF-13). Nunca serializa coordenadas nem contato.
async function handleExplore(userId: string, url: URL): Promise<Response> {
  requireFeature("explore");
  const query = exploreQuerySchema.parse({
    radius: url.searchParams.get("radius") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profile.completedAt) {
    return fail(409, "profile_incomplete", "Complete seu perfil para explorar jogadores.");
  }

  const radiusKm = query.radius ?? profile.radiusKm;
  const offset = query.page * EXPLORE_PAGE_SIZE;

  // pede uma linha a mais p/ saber se há próxima página (paginação estável)
  const candidates = await findExplorePlayers({
    viewerId: userId,
    viewerLat: profile.lat,
    viewerLng: profile.lng,
    radiusKm,
    limit: EXPLORE_PAGE_SIZE + 1,
    offset,
  });
  const hasMore = candidates.length > EXPLORE_PAGE_SIZE;
  const pageItems = candidates.slice(0, EXPLORE_PAGE_SIZE);

  // interseção com a coleção do buscador (destaca o jogo em comum na UI)
  const myGames = await prisma.userGame.findMany({ where: { userId }, select: { gameId: true } });
  const mySet = new Set(myGames.map((g) => g.gameId));

  const peopleEntries = pageItems.map((c) => ({
    dist: c.distanceKm,
    entry: {
      userId: c.userId,
      displayName: c.displayName,
      photoUrl: c.photoUrl,
      approxDistance: formatApproxDistance(c.distanceKm),
      wantsToPlay: c.wants.map((w) => ({
        gameId: w.gameId,
        name: w.name,
        inMyCollection: mySet.has(w.gameId),
      })),
    } as ExploreEntry,
  }));

  // grupos entram só na primeira página (mesclados por distância)
  const groups =
    query.page === 0
      ? await groupEntries(userId, profile.lat, profile.lng, radiusKm, undefined)
      : [];
  const results = [...peopleEntries, ...groups].sort((a, b) => a.dist - b.dist).map((e) => e.entry);

  await track("busca_explorar_realizada", userId, { page: query.page, results: results.length });
  if (groups.length > 0) {
    await track("grupo_exibido_em_busca", userId, { count: groups.length });
  }

  const response: ExploreResponse = { results, page: query.page, hasMore, radiusKm };
  return ok(response);
}
