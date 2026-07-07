import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { gameIdSchema } from "@/shared/schemas";

// BE-11 — DELETE /api/intents/:gameId cancela o "quero jogar" (RF-21).
export const DELETE = withApi<{ params: Promise<{ gameId: string }> }>(
  "intents.cancel",
  async (_req, ctx) => {
    const { userId } = await requireUser();
    const gameId = gameIdSchema.parse((await ctx.params).gameId);

    await prisma.playIntent.updateMany({
      where: { userId, gameId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    return ok({ cancelled: true });
  },
);
