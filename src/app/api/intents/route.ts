import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { track } from "@/server/events/track";
import { intentTtlDays } from "@/server/matching/interests";
import { intentCreateSchema } from "@/shared/schemas";

// BE-11 — POST /api/intents {gameId}: valida jogo na coleção; upsert
// ACTIVE com expiresAt=now()+7d (renova se existente). RF-21.
export const POST = withApi("intents.create", async (req) => {
  const { userId } = await requireUser();
  const { gameId } = intentCreateSchema.parse(await req.json());

  const owned = await prisma.userGame.findUnique({
    where: { userId_gameId: { userId, gameId } },
  });
  if (!owned) {
    return fail(422, "game_not_in_collection", "Adicione o jogo à sua coleção antes.");
  }

  const expiresAt = new Date(Date.now() + intentTtlDays() * 24 * 60 * 60 * 1000);
  const intent = await prisma.playIntent.upsert({
    where: { userId_gameId: { userId, gameId } },
    create: { userId, gameId, status: "ACTIVE", expiresAt },
    update: { status: "ACTIVE", expiresAt },
  });

  await track("intent_created", userId, { gameId });
  return ok({ id: intent.id, expiresAt: intent.expiresAt.toISOString() }, { status: 201 });
});
