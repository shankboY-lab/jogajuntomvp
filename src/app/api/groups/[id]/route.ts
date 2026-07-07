import { ok, withApi, requireUser, requireFeature } from "@/server/http";
import { getGroupDetail, cancelGroup } from "@/server/groups/service";

// BE-24 — GET /api/groups/:id (detalhe por papel) e DELETE (cancelar, só criador).
export const GET = withApi<{ params: Promise<{ id: string }> }>(
  "groups.detail",
  async (_req, ctx) => {
    requireFeature("groups");
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const detail = await getGroupDetail(id, userId);
    return ok(detail);
  },
);

export const DELETE = withApi<{ params: Promise<{ id: string }> }>(
  "groups.cancel",
  async (_req, ctx) => {
    requireFeature("groups");
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    await cancelGroup(id, userId);
    return ok({ cancelled: true });
  },
);
