import { ok, withApi, requireUser, requireFeature } from "@/server/http";
import { leaveOrRemoveMember } from "@/server/groups/service";

// BE-26 — DELETE /api/groups/:id/members/:userId (sair=self ou remover=criador).
export const DELETE = withApi<{ params: Promise<{ id: string; userId: string }> }>(
  "groups.member.remove",
  async (_req, ctx) => {
    requireFeature("groups");
    const { userId: actingUserId } = await requireUser();
    const { id, userId: targetUserId } = await ctx.params;
    await leaveOrRemoveMember(id, targetUserId, actingUserId);
    return ok({ removed: true });
  },
);
