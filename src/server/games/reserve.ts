import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { toGameSummary } from "@/server/games/catalog";
import type { GameSummary } from "@/shared/types";

// DB-08 — busca por similaridade no banco reserva (pg_trgm). Serve a dois usos:
//   (1) dedup de cadastro manual (RF-33) — achar jogos parecidos antes de criar;
//   (2) busca no catálogo local quando a BGG está fora (RF-30, fallback do BE-19).
// Usa o índice GIN gin_trgm_ops em games.name (criado na migration DB-07).

/** Threshold de similaridade trigram (0..1). Calibrável por env (RF-33). */
export function dedupThreshold(): number {
  const raw = Number(process.env.GAME_DEDUP_THRESHOLD);
  return Number.isFinite(raw) && raw > 0 && raw <= 1 ? raw : 0.35;
}

export interface ReserveOptions {
  limit?: number;
  /** Restringe a origem (ex.: só USER_CREATED no merge da busca). */
  source?: "BGG" | "USER_CREATED";
}

/**
 * Busca no reserva por nome. `similarity(name, term) > threshold` ordenado por
 * similaridade; para termos curtos (< 4 chars) o trigram é ruidoso, então cai
 * para `ILIKE %term%`. Retorna GameSummary já materializado (tem gameId).
 */
export async function searchReserve(
  rawTerm: string,
  opts: ReserveOptions = {},
): Promise<GameSummary[]> {
  const term = rawTerm.trim();
  if (term.length === 0) return [];
  const limit = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const threshold = dedupThreshold();

  const sourceFilter =
    opts.source != null ? Prisma.sql`AND source = ${opts.source}::"GameSource"` : Prisma.empty;

  const rows =
    term.length < 4
      ? await prisma.$queryRaw<GameRow[]>(Prisma.sql`
          SELECT id, bgg_id, name, year_published, thumbnail_url, min_players, max_players, source, created_by_id, cached_at
          FROM games
          WHERE name ILIKE ${"%" + term + "%"} ${sourceFilter}
          ORDER BY name ASC
          LIMIT ${limit}
        `)
      : await prisma.$queryRaw<GameRow[]>(Prisma.sql`
          SELECT id, bgg_id, name, year_published, thumbnail_url, min_players, max_players, source, created_by_id, cached_at
          FROM games
          WHERE similarity(name, ${term}) > ${threshold} ${sourceFilter}
          ORDER BY similarity(name, ${term}) DESC, name ASC
          LIMIT ${limit}
        `);

  return rows.map(rowToSummary);
}

interface GameRow {
  id: string;
  bgg_id: number | null;
  name: string;
  year_published: number | null;
  thumbnail_url: string | null;
  min_players: number | null;
  max_players: number | null;
  source: "BGG" | "USER_CREATED";
  created_by_id: string | null;
  cached_at: Date;
}

function rowToSummary(r: GameRow): GameSummary {
  return toGameSummary({
    id: r.id,
    bggId: r.bgg_id,
    name: r.name,
    yearPublished: r.year_published,
    thumbnailUrl: r.thumbnail_url,
    minPlayers: r.min_players,
    maxPlayers: r.max_players,
    source: r.source,
    createdById: r.created_by_id,
    cachedAt: r.cached_at,
  });
}
