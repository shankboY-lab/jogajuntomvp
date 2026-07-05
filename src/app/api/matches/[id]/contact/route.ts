import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { track } from "@/server/events/track";
import type { ContactResponse } from "@/shared/types";

// BE-15 — GET /api/matches/:id/contact (RF-25/26, RNF-09):
// valida que o solicitante participa do match e SÓ ENTÃO monta os deep links.
// Nenhum outro endpoint serializa whatsapp/telegram.
export const GET = withApi<{ params: Promise<{ id: string }> }>(
  "matches.contact",
  async (req, ctx) => {
    const { userId } = await requireUser();
    const { id } = await ctx.params;
    const channel = new URL(req.url).searchParams.get("channel");

    const match = await prisma.match.findUnique({ where: { id } });
    if (!match || (match.userLoId !== userId && match.userHiId !== userId)) {
      return fail(404, "match_not_found", "Match não encontrado.");
    }

    const partnerId = match.userLoId === userId ? match.userHiId : match.userLoId;
    const [partnerProfile, game] = await Promise.all([
      prisma.profile.findUnique({ where: { userId: partnerId } }),
      prisma.game.findUnique({ where: { bggId: match.bggId } }),
    ]);
    if (!partnerProfile) {
      return fail(404, "partner_not_found", "O outro jogador não está mais disponível.");
    }

    const gameName = game?.name ?? "um jogo";
    const message = `Oi! Deu match no JogaJunto 🎲 Bora marcar uma partida de ${gameName}?`;

    const whatsappUrl = partnerProfile.whatsapp
      ? `https://wa.me/${partnerProfile.whatsapp.replace("+", "")}?text=${encodeURIComponent(message)}`
      : null;
    const telegramUrl = partnerProfile.telegram ? `https://t.me/${partnerProfile.telegram}` : null;

    // métrica primária do PRD §2 — registrada quando o clique informa o canal
    if (channel === "whatsapp" || channel === "telegram") {
      await track("contact_clicked", userId, { channel, matchId: match.id, bggId: match.bggId });
    }

    const response: ContactResponse = { whatsappUrl, telegramUrl };
    return ok(response);
  },
);
