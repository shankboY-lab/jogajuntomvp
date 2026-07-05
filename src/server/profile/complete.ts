import { prisma } from "@/server/db";
import { track } from "@/server/events/track";
import { isProfileCompleteRule } from "@/shared/profileRule";

/**
 * BE-06 — regra do perfil completo (dirige RF-04):
 * nome + localização + consent + >=1 contato + >=1 jogo na coleção.
 * Chamado após PUT /api/profile e após mudanças na coleção.
 */
export async function recomputeProfileComplete(userId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return false;

  const gamesCount = await prisma.userGame.count({ where: { userId } });
  const complete = isProfileCompleteRule({
    displayName: profile.displayName,
    city: profile.city,
    hasCoords: Number.isFinite(profile.lat) && Number.isFinite(profile.lng),
    hasConsent: profile.locationConsentAt !== null,
    whatsapp: profile.whatsapp,
    telegram: profile.telegram,
    gamesCount,
  });

  if (complete && !profile.completedAt) {
    await prisma.profile.update({ where: { userId }, data: { completedAt: new Date() } });
    await track("profile_completed", userId);
  } else if (!complete && profile.completedAt) {
    await prisma.profile.update({ where: { userId }, data: { completedAt: null } });
  }
  return complete;
}
