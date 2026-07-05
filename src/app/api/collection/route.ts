import { prisma } from "@/server/db";
import { ensureGames } from "@/server/bgg/client";
import { ok, withApi, requireUser } from "@/server/http";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { track } from "@/server/events/track";
import { collectionAddSchema } from "@/shared/schemas";
import type { CollectionItem } from "@/shared/types";

// BE-10 — coleção (RF-13/14). Dois usuários com "Catan" referenciam o mesmo bggId.

export const GET = withApi("collection.get", async () => {
  const { userId } = await requireUser();
  const userGames = await prisma.userGame.findMany({
    where: { userId },
    include: { game: true },
    orderBy: { addedAt: "asc" },
  });
  const intents = await prisma.playIntent.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: new Date() } },
    select: { bggId: true },
  });
  const activeIntents = new Set(intents.map((i) => i.bggId));

  const items: CollectionItem[] = userGames.map((ug) => ({
    bggId: ug.game.bggId,
    name: ug.game.name,
    yearPublished: ug.game.yearPublished,
    thumbnailUrl: ug.game.thumbnailUrl,
    intentActive: activeIntents.has(ug.bggId),
  }));
  return ok({ items });
});

export const POST = withApi("collection.add", async (req) => {
  const { userId } = await requireUser();
  const { bggId } = collectionAddSchema.parse(await req.json());

  // garante Game em cache (chama thing se preciso) — RF-13
  await ensureGames([bggId]);

  await prisma.userGame.upsert({
    where: { userId_bggId: { userId, bggId } },
    create: { userId, bggId },
    update: {},
  });

  await track("game_added", userId, { bggId });
  const profileComplete = await recomputeProfileComplete(userId);
  return ok({ added: true, profileComplete }, { status: 201 });
});
