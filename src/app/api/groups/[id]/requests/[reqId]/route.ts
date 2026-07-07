import { ok, withApi, requireUser, requireFeature } from "@/server/http";
import { respondToJoinRequest } from "@/server/groups/service";
import { groupRequestRespondSchema } from "@/shared/schemas";

// BE-25 — PATCH /api/groups/:id/requests/:reqId (accept/decline, só criador).
export const PATCH = withApi<{ params: Promise<{ id: string; reqId: string }> }>(
  "groups.respond",
  async (req, ctx) => {
    requireFeature("groups");
    const { userId } = await requireUser();
    const { id, reqId } = await ctx.params;
    const { action } = groupRequestRespondSchema.parse(await req.json());
    const result = await respondToJoinRequest(id, reqId, userId, action);
    return ok(result);
  },
);
