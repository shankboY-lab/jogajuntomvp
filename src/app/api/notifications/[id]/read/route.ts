import { prisma } from "@/server/db";
import { ok, withApi, requireUser, requireFeature } from "@/server/http";

// BE-27 — PATCH /api/notifications/:id/read (marca como lida; só do próprio dono).
export const PATCH = withApi<{ params: Promise<{ id: string }> }>(
  "notifications.read",
  async (_req, ctx) => {
    requireFeature("groups");
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    await prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ read: true });
  },
);
