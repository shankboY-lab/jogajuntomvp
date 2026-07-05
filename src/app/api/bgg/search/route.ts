import { bggSearch } from "@/server/bgg/client";
import { ok, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";

// BE-08 — GET /api/bgg/search?q= (RF-11/15, RNF-05)
export const GET = withApi("bgg.search", async (req) => {
  await requireUser();
  await assertIpLimit(clientIp(req), "bgg", 30, 60);

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const items = await bggSearch(q);
  return ok({ items });
});
