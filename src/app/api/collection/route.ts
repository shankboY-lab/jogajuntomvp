import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { resolveGameId, toGameSummary } from "@/server/games/catalog";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { track } from "@/server/events/track";
import { collectionAddSchema } from "@/shared/schemas";
import type { CollectionItem } from "@/shared/types";

// BE-10 — coleção (RF-13/14). Chave interna games.id (v3/DB-07).

export const GET = withApi("collection.get", async () => {
  const { userId } = await requireUser();
  const userGames = await prisma.userGame.findMany({
    where: { userId },
    include: { game: true },
    orderBy: { addedAt: "asc" },
  });
  const intents = await prisma.playIntent.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { gameId: true },
  });
  const activeIntents = new Set(intents.map((i) => i.gameId));

  const items: CollectionItem[] = userGames.map((ug) => ({
    ...toGameSummary(ug.game),
    intentActive: activeIntents.has(ug.gameId),
  }));
  return ok({ items });
});

export const POST = withApi("collection.add", async (req) => {
  const { userId } = await requireUser();
  const body = collectionAddSchema.parse(await req.json());

  // resolve p/ id interno; bggId materializa o Game (chama thing se preciso — RF-13)
  const ref = "gameId" in body ? body.gameId : String(body.bggId);
  const gameId = await resolveGameId(ref);
  if (!gameId) return fail(404, "game_not_found", "Jogo não encontrado.");

  await prisma.userGame.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId },
    update: {},
  });

  await track("game_added", userId, { gameId });
  const profileComplete = await recomputeProfileComplete(userId);
  return ok({ added: true, profileComplete }, { status: 201 });
});
