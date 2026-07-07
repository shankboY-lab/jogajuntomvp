import type { Game } from "@prisma/client";
import { prisma } from "@/server/db";
import { ensureGames } from "@/server/bgg/client";
import type { GameSummary, GameSource } from "@/shared/types";

// v3/DB-07 — utilitários do catálogo em torno da PK interna `games.id`.

/** Mapeia uma linha `Game` para o shape público `GameSummary`. */
export function toGameSummary(g: Game): GameSummary {
  return {
    gameId: g.id,
    bggId: g.bggId,
    name: g.name,
    yearPublished: g.yearPublished,
    thumbnailUrl: g.thumbnailUrl,
    source: g.source as GameSource,
  };
}

/**
 * Resolve uma referência pública de jogo para o `id` interno canônico.
 * Aceita o id interno (cuid) OU um bggId numérico legado — este é o
 * "redirect de compatibilidade" de `/busca/[bggId]` → `[gameId]` no nível da API
 * (QA-08). Materializa o jogo BGG (thing) se ainda não estiver no catálogo.
 * Retorna `null` quando a referência não resolve.
 */
export async function resolveGameId(ref: string): Promise<string | null> {
  if (/^\d+$/.test(ref)) {
    const bggId = Number(ref);
    const existing = await prisma.game.findUnique({ where: { bggId } });
    if (existing) return existing.id;
    const [ensured] = await ensureGames([bggId]);
    return ensured?.gameId ?? null;
  }
  const game = await prisma.game.findUnique({ where: { id: ref } });
  return game?.id ?? null;
}
