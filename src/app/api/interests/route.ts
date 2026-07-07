import { ok, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";
import { sendInterest } from "@/server/matching/interests";
import { interestCreateSchema } from "@/shared/schemas";

// BE-13 — POST /api/interests {toUserId, gameId}: transação serializable;
// recíproco → match imediato (RF-22/24). Repetir envio → 200 no-op.
export const POST = withApi("interests.create", async (req) => {
  const { userId } = await requireUser();
  await assertIpLimit(clientIp(req), "interests", 20, 60);

  const body = interestCreateSchema.parse(await req.json());
  const result = await sendInterest({
    fromUserId: userId,
    toUserId: body.toUserId,
    gameId: body.gameId,
  });

  return ok(result, { status: result.outcome === "matched" ? 201 : 200 });
});
