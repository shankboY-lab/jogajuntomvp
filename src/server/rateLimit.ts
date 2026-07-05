import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";

// BE-08/INF-06 — token bucket distribuído em Postgres (Vercel é serverless:
// instâncias concorrentes precisam compartilhar o limitador). SELECT ... FOR UPDATE
// serializa o acesso ao bucket.

export interface BucketConfig {
  /** capacidade máxima de tokens */
  capacity: number;
  /** tokens repostos por segundo */
  refillPerSec: number;
}

export interface TakeResult {
  allowed: boolean;
  retryAfterMs: number;
}

export async function takeToken(key: string, cfg: BucketConfig, cost = 1): Promise<TakeResult> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        INSERT INTO rate_limit_buckets (key, tokens, updated_at)
        VALUES (${key}, ${cfg.capacity}, now())
        ON CONFLICT (key) DO NOTHING`;
      const rows = await tx.$queryRaw<{ tokens: number; updated_at: Date }[]>`
        SELECT tokens, updated_at FROM rate_limit_buckets WHERE key = ${key} FOR UPDATE`;
      const row = rows[0];
      const now = Date.now();
      const elapsedSec = Math.max(0, (now - row.updated_at.getTime()) / 1000);
      const tokens = Math.min(cfg.capacity, row.tokens + elapsedSec * cfg.refillPerSec);
      if (tokens >= cost) {
        await tx.$executeRaw`
          UPDATE rate_limit_buckets SET tokens = ${tokens - cost}, updated_at = now()
          WHERE key = ${key}`;
        return { allowed: true, retryAfterMs: 0 };
      }
      await tx.$executeRaw`
        UPDATE rate_limit_buckets SET tokens = ${tokens}, updated_at = now()
        WHERE key = ${key}`;
      const retryAfterMs = Math.ceil(((cost - tokens) / cfg.refillPerSec) * 1000);
      return { allowed: false, retryAfterMs };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fila de espera para integrações externas (BGG ~1 req/5s, Nominatim 1 req/s):
 * aguarda até conseguir um token ou estourar maxWaitMs.
 */
export async function waitForToken(
  key: string,
  cfg: BucketConfig,
  maxWaitMs = 30_000,
): Promise<boolean> {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    const res = await takeToken(key, cfg);
    if (res.allowed) return true;
    if (Date.now() + res.retryAfterMs > deadline) return false;
    await sleep(Math.min(Math.max(res.retryAfterMs, 100), 5_000));
  }
}

/** INF-06 — rate limit por IP nas rotas sensíveis; lança 429 quando estourado. */
export async function assertIpLimit(
  ip: string,
  route: string,
  capacity: number,
  perSeconds: number,
): Promise<void> {
  const res = await takeToken(`ip:${route}:${ip}`, {
    capacity,
    refillPerSec: capacity / perSeconds,
  });
  if (!res.allowed) {
    throw new ApiError(429, "rate_limited", "Muitas requisições. Aguarde um instante.", {
      retryAfter: Math.ceil(res.retryAfterMs / 1000),
    });
  }
}
