import { ensureGames } from "@/server/bgg/client";
import { ok, fail, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";

// BE-09 — GET /api/bgg/thing?ids=1,2,... (RF-12/13) — batch de até 20 ids
export const GET = withApi("bgg.thing", async (req) => {
  await requireUser();
  await assertIpLimit(clientIp(req), "bgg", 30, 60);

  const idsParam = new URL(req.url).searchParams.get("ids") ?? "";
  const ids = idsParam
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);

  if (ids.length === 0 || ids.length > 20) {
    return fail(422, "invalid_ids", "Informe de 1 a 20 ids numéricos separados por vírgula.");
  }

  const games = await ensureGames(ids);
  return ok({ games });
});
