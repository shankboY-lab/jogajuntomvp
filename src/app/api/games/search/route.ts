import { ok, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";
import { searchCatalog } from "@/server/games/mergedSearch";
import { track } from "@/server/events/track";

// BE-19 — GET /api/games/search?q= (RF-29/30/31). Evolui /api/bgg/search:
// mescla BGG + banco reserva, sinaliza bggDown e canCreateManual (a UI não
// decide o CTA manual sozinha — RF-31). Sem chamada direta do browser à BGG.
export const GET = withApi("games.search", async (req) => {
  const { userId } = await requireUser();
  await assertIpLimit(clientIp(req), "bgg", 30, 60);

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await searchCatalog(q);

  if (result.bggDown && q.trim().length >= 3) {
    await track("busca_reserva_realizada", userId, { count: result.items.length });
  }
  return ok(result);
});
