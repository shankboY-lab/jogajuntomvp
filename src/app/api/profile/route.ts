import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { profileSchema, normalizeWhatsapp, normalizeTelegram } from "@/shared/schemas";
import { roundCoord } from "@/server/geo/distance";
import type { ProfileResponse } from "@/shared/types";

// BE-06 — GET/PUT /api/profile (RF-06..10, RF-27).
// Coordenadas NUNCA são serializadas de volta (RNF-07) — nem as do próprio usuário.

export const GET = withApi("profile.get", async () => {
  const { userId } = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user) return fail(404, "user_not_found", "Usuário não encontrado.");

  const p = user.profile;
  const response: ProfileResponse = {
    displayName: p?.displayName ?? user.name ?? "",
    photoUrl: p?.photoUrl ?? user.image ?? null,
    city: p?.city ?? "",
    neighborhood: p?.neighborhood ?? null,
    radiusKm: p?.radiusKm ?? 5,
    whatsapp: p?.whatsapp ?? null,
    telegram: p?.telegram ?? null,
    hasLocation: Boolean(p),
    profileComplete: Boolean(p?.completedAt),
    email: user.email,
    hasPassword: Boolean(user.passwordHash),
  };
  return ok(response);
});

export const PUT = withApi("profile.put", async (req) => {
  const { userId } = await requireUser();
  const body = profileSchema.parse(await req.json());

  const whatsapp = body.whatsapp ? normalizeWhatsapp(body.whatsapp) : null;
  const telegram = body.telegram ? normalizeTelegram(body.telegram) : null;

  const existing = await prisma.profile.findUnique({ where: { userId } });

  // lat/lng null = edição sem mudar a localização → reusa as coordenadas salvas
  let lat: number;
  let lng: number;
  if (body.lat != null && body.lng != null) {
    lat = roundCoord(body.lat);
    lng = roundCoord(body.lng);
  } else if (existing) {
    lat = existing.lat;
    lng = existing.lng;
  } else {
    return fail(422, "location_required", "Informe sua localização.");
  }

  const data = {
    displayName: body.displayName,
    photoUrl: body.photoUrl ?? existing?.photoUrl ?? null,
    city: body.city,
    neighborhood: body.neighborhood ?? null,
    lat,
    lng,
    radiusKm: body.radiusKm,
    whatsapp,
    telegram,
    // RF-27 — consent obrigatório; o schema já rejeita locationConsent=false (422)
    locationConsentAt: existing?.locationConsentAt ?? new Date(),
  };

  await prisma.profile.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  const profileComplete = await recomputeProfileComplete(userId);
  // o cliente chama session.update() para refletir o claim no JWT (BE-04/FE-05)
  return ok({ profileComplete });
});
