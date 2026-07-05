import { prisma } from "@/server/db";
import { logger } from "@/server/logger";
import type { EventName } from "@/shared/schemas";

/**
 * BE-16/RNF-10 — gravação de eventos do funil. Eventos server-side críticos
 * (match, contato, busca) são gravados direto pelos endpoints; o cliente só
 * manda os de navegação via POST /api/events.
 * Fire-and-forget: analytics nunca derruba a request principal.
 */
export async function track(
  name: EventName,
  userId: string | null,
  props: Record<string, string | number | boolean> = {},
): Promise<void> {
  try {
    await prisma.event.create({ data: { name, userId, props } });
  } catch (err) {
    logger.warn({ msg: "event_track_failed", name, err: String(err) });
  }
}
