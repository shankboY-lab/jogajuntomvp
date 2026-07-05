import { prisma } from "@/server/db";
import { ok, withApi, requireUser } from "@/server/http";
import { bggIdSchema } from "@/shared/schemas";

// BE-11 — DELETE /api/intents/:bggId cancela o "quero jogar" (RF-21)
export const DELETE = withApi<{ params: Promise<{ bggId: string }> }>(
  "intents.cancel",
  async (_req, ctx) => {
    const { userId } = await requireUser();
    const bggId = bggIdSchema.parse((await ctx.params).bggId);

    await prisma.playIntent.updateMany({
      where: { userId, bggId, status: "ACTIVE" },
      data: { status: "CANCELLED" },
    });
    return ok({ cancelled: true });
  },
);
