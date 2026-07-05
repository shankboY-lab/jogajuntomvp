import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { bggIdSchema } from "@/shared/schemas";

// BE-10 — DELETE /api/collection/:bggId. Remoção também cancela PlayIntent
// ativo daquele jogo (consistência).
export const DELETE = withApi<{ params: Promise<{ bggId: string }> }>(
  "collection.remove",
  async (_req, ctx) => {
    const { userId } = await requireUser();
    const bggId = bggIdSchema.parse((await ctx.params).bggId);

    await prisma.$transaction([
      prisma.userGame.deleteMany({ where: { userId, bggId } }),
      prisma.playIntent.updateMany({
        where: { userId, bggId, status: "ACTIVE" },
        data: { status: "CANCELLED" },
      }),
    ]);

    const profileComplete = await recomputeProfileComplete(userId);
    return ok({ removed: true, profileComplete });
  },
);
