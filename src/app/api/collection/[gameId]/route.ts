import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { gameIdSchema } from "@/shared/schemas";

// BE-10 — DELETE /api/collection/:gameId. Remoção também cancela PlayIntent
// ativo daquele jogo (consistência). Chave interna games.id (v3/DB-07).
export const DELETE = withApi<{ params: Promise<{ gameId: string }> }>(
  "collection.remove",
  async (_req, ctx) => {
    const { userId } = await requireUser();
    const gameId = gameIdSchema.parse((await ctx.params).gameId);

    await prisma.$transaction([
      prisma.userGame.deleteMany({ where: { userId, gameId } }),
      prisma.playIntent.updateMany({
        where: { userId, gameId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      }),
    ]);

    const profileComplete = await recomputeProfileComplete(userId);
    return ok({ removed: true, profileComplete });
  },
);
