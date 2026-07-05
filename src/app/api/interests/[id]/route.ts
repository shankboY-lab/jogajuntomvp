import { ok, withApi, requireUser } from "@/server/http";
import { respondToInterest } from "@/server/matching/interests";
import { interestRespondSchema } from "@/shared/schemas";

// BE-13 — PATCH /api/interests/:id {action: accept|decline} — só o destinatário (RF-23)
export const PATCH = withApi<{ params: Promise<{ id: string }> }>(
  "interests.respond",
  async (req, ctx) => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const { action } = interestRespondSchema.parse(await req.json());

    const result = await respondToInterest({ requestId: id, userId, action });
    return ok(result);
  },
);
