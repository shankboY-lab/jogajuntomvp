import { ok, withApi, requireUser, requireFeature, clientIp } from "@/server/http";
import { assertIpLimit, assertUserLimit } from "@/server/rateLimit";
import { createGroup } from "@/server/groups/service";
import { groupCreateSchema } from "@/shared/schemas";

// BE-24 — POST /api/groups (RF-41/50). Rate limit burst 10/min/usuário (INF-09).
export const POST = withApi("groups.create", async (req) => {
  requireFeature("groups");
  const { userId } = await requireUser();
  await assertIpLimit(clientIp(req), "groups", 20, 60);
  await assertUserLimit(
    userId,
    "groups",
    10,
    60,
    "Muitos grupos em pouco tempo. Aguarde um instante.",
  );

  const input = groupCreateSchema.parse(await req.json());
  const group = await createGroup(userId, input);
  return ok({ groupId: group.id }, { status: 201 });
});
