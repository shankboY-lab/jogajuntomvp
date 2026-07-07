import { ok, withApi, requireUser, requireFeature, clientIp } from "@/server/http";
import { assertIpLimit, assertUserLimit } from "@/server/rateLimit";
import { requestJoin } from "@/server/groups/service";

// BE-25 — POST /api/groups/:id/requests (RF-43/51). Burst 10/min/usuário.
export const POST = withApi<{ params: Promise<{ id: string }> }>(
  "groups.request",
  async (req, ctx) => {
    requireFeature("groups");
    const { userId } = await requireUser();
    await assertIpLimit(clientIp(req), "groups", 20, 60);
    await assertUserLimit(
      userId,
      "group_requests",
      10,
      60,
      "Muitos pedidos em pouco tempo. Aguarde.",
    );

    const { id } = await ctx.params;
    await requestJoin(id, userId);
    return ok({ requested: true }, { status: 201 });
  },
);
