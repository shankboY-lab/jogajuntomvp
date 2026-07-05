import { geocodeForward } from "@/server/geo/nominatim";
import { ok, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";

// BE-07 — GET /api/geocode?q=cidade+bairro (RF-08, forward)
export const GET = withApi("geocode.forward", async (req) => {
  await requireUser();
  await assertIpLimit(clientIp(req), "geocode", 20, 60);

  const q = new URL(req.url).searchParams.get("q") ?? "";
  const result = await geocodeForward(q);
  return ok({ result });
});
