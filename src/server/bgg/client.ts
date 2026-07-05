import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { logger } from "@/server/logger";
import { waitForToken } from "@/server/rateLimit";
import { parseBggSearch, parseBggThing } from "@/server/bgg/parse";
import type { BggSearchItem, GameSummary } from "@/shared/types";

// BE-08/BE-09 — proxy server-side obrigatório (RNF-05). O cliente NUNCA fala com a BGG.
// Endpoint sem www — exigência do PRD.
const BGG_BASE = "https://boardgamegeek.com/xmlapi2";
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// fila global: 1 req a cada 5s (RNF-05)
const BGG_BUCKET = { capacity: 1, refillPerSec: 1 / 5 };

export class BggUnavailableError extends ApiError {
  constructor(retryAfterSec = 10) {
    super(
      503,
      "bgg_unavailable",
      "O BoardGameGeek está indisponível no momento. Tente novamente.",
      {
        retryAfter: retryAfterSec,
      },
    );
  }
}

// single-flight: requisições iguais simultâneas (nesta instância) aguardam a mesma promise
const inFlight = new Map<string, Promise<unknown>>();

function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, p);
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Chamada BGG com fila (token bucket distribuído) + retry com backoff
 * exponencial 1s→2s→4s em 500/503/timeout e no 202 "queued" da BGG.
 */
async function bggFetch(path: string): Promise<string> {
  const backoffs = [1_000, 2_000, 4_000];
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const gotToken = await waitForToken("bgg", BGG_BUCKET, 30_000);
    if (!gotToken) throw new BggUnavailableError(10);
    try {
      const res = await fetch(`${BGG_BASE}${path}`, {
        headers: { Accept: "application/xml" },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (res.status === 200) return await res.text();
      // 202 = BGG enfileirou a resposta; 500/503 = instabilidade → backoff
      if (res.status === 202 || res.status === 500 || res.status === 503 || res.status === 429) {
        lastError = new Error(`BGG respondeu ${res.status}`);
      } else {
        throw new BggUnavailableError();
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      lastError = err; // timeout / rede
    }
    if (attempt < backoffs.length) await sleep(backoffs[attempt]);
  }
  logger.warn({ msg: "bgg_exhausted_retries", err: String(lastError) });
  throw new BggUnavailableError();
}

export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Fallback quando a BGG está indisponível (ela bloqueia IPs de datacenter —
 * inclusive Vercel): busca no catálogo local `games`, populado pelo seed
 * (scripts/seed-catalog.ts) e enriquecido a cada resposta real da BGG.
 */
async function searchLocalCatalog(queryNorm: string): Promise<BggSearchItem[]> {
  const games = await prisma.game.findMany({
    where: { name: { contains: queryNorm, mode: "insensitive" } },
    orderBy: { name: "asc" },
    take: 20,
  });
  return games.map((g) => ({ bggId: g.bggId, name: g.name, yearPublished: g.yearPublished }));
}

/** BE-08 — busca com cache Postgres (TTL 24h) + single-flight + fila 5s. */
export async function bggSearch(rawQuery: string): Promise<BggSearchItem[]> {
  const queryNorm = normalizeQuery(rawQuery);
  if (queryNorm.length < 3) return [];

  const cached = await prisma.bggSearchCache.findUnique({ where: { queryNorm } });
  if (cached && Date.now() - cached.cachedAt.getTime() < SEARCH_CACHE_TTL_MS) {
    return cached.payload as unknown as BggSearchItem[];
  }

  return singleFlight(`search:${queryNorm}`, async () => {
    let xml: string;
    try {
      const params = new URLSearchParams({ query: queryNorm, type: "boardgame" });
      xml = await bggFetch(`/search?${params.toString()}`);
    } catch (err) {
      // BGG fora → tenta o catálogo local; sem resultado local, propaga o 503
      if (err instanceof BggUnavailableError) {
        const local = await searchLocalCatalog(queryNorm);
        if (local.length > 0) return local;
      }
      throw err;
    }
    const items = parseBggSearch(xml);
    await prisma.bggSearchCache.upsert({
      where: { queryNorm },
      create: { queryNorm, payload: items as unknown as object[] },
      update: { payload: items as unknown as object[], cachedAt: new Date() },
    });
    return items;
  });
}

/**
 * BE-09 — detalhes (thing) em batch de até 20 ids. Upsert em Game (cache
 * permanente do catálogo, RF-13); ids já cacheados não geram chamada externa.
 */
export async function ensureGames(bggIds: number[]): Promise<GameSummary[]> {
  const ids = [...new Set(bggIds)].slice(0, 20);
  if (ids.length === 0) return [];

  const cached = await prisma.game.findMany({ where: { bggId: { in: ids } } });
  const cachedIds = new Set(cached.map((g) => g.bggId));
  const missing = ids.filter((id) => !cachedIds.has(id));

  let fetched: GameSummary[] = [];
  if (missing.length > 0) {
    fetched = await singleFlight(`thing:${missing.join(",")}`, async () => {
      const params = new URLSearchParams({ id: missing.join(","), type: "boardgame" });
      const xml = await bggFetch(`/thing?${params.toString()}`);
      return parseBggThing(xml);
    });
    for (const game of fetched) {
      await prisma.game.upsert({
        where: { bggId: game.bggId },
        create: {
          bggId: game.bggId,
          name: game.name,
          yearPublished: game.yearPublished,
          thumbnailUrl: game.thumbnailUrl,
        },
        update: {
          name: game.name,
          yearPublished: game.yearPublished,
          thumbnailUrl: game.thumbnailUrl,
          cachedAt: new Date(),
        },
      });
    }
  }

  const byId = new Map<number, GameSummary>();
  for (const g of cached) {
    byId.set(g.bggId, {
      bggId: g.bggId,
      name: g.name,
      yearPublished: g.yearPublished,
      thumbnailUrl: g.thumbnailUrl,
    });
  }
  for (const g of fetched) byId.set(g.bggId, g);
  return ids.map((id) => byId.get(id)).filter((g): g is GameSummary => !!g);
}
