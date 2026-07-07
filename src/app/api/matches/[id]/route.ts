import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { haversineKm, formatApproxDistance } from "@/server/geo/distance";
import { toGameSummary } from "@/server/games/catalog";
import type { MatchDetailResponse } from "@/shared/types";

// FE-12 — dados da tela de match (v2-08). SEM contato: os links saem apenas
// de /api/matches/:id/contact (RNF-09). Indica só QUAIS canais existem.
export const GET = withApi<{ params: Promise<{ id: string }> }>(
  "matches.detail",
  async (_req, ctx) => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;

    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        userLo: { include: { profile: true } },
        userHi: { include: { profile: true } },
        game: true,
      },
    });
    if (!match || (match.userLoId !== userId && match.userHiId !== userId)) {
      return fail(404, "match_not_found", "Match não encontrado.");
    }

    const me = match.userLoId === userId ? match.userLo : match.userHi;
    const partner = match.userLoId === userId ? match.userHi : match.userLo;

    const approxDistance =
      me.profile && partner.profile
        ? formatApproxDistance(
            haversineKm(me.profile.lat, me.profile.lng, partner.profile.lat, partner.profile.lng),
          )
        : "";

    const response: MatchDetailResponse = {
      matchId: match.id,
      partner: {
        displayName: partner.profile?.displayName ?? "Jogador(a)",
        photoUrl: partner.profile?.photoUrl ?? null,
      },
      me: {
        displayName: me.profile?.displayName ?? "Você",
        photoUrl: me.profile?.photoUrl ?? null,
      },
      game: toGameSummary(match.game),
      approxDistance,
      channels: {
        whatsapp: Boolean(partner.profile?.whatsapp),
        telegram: Boolean(partner.profile?.telegram),
      },
    };
    return ok(response);
  },
);
