import { z } from "zod";
import { geocodeReverse } from "@/server/geo/nominatim";
import { ok, withApi, requireUser, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";

const reverseSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// BE-07 — POST /api/geocode/reverse {lat,lng} (RF-08, coords do browser)
export const POST = withApi("geocode.reverse", async (req) => {
  await requireUser();
  await assertIpLimit(clientIp(req), "geocode", 20, 60);

  const { lat, lng } = reverseSchema.parse(await req.json());
  const result = await geocodeReverse(lat, lng);
  return ok({ result });
});
