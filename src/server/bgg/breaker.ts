import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { track } from "@/server/events/track";
import { logger } from "@/server/logger";

// BE-18 — circuit breaker do proxy BGG (D2). Estado compartilhado em Postgres
// para que instâncias serverless concorrentes enxerguem o mesmo breaker.
//   closed     → tudo normal.
//   open       → BGG considerada fora; falha rápido (RNF-16) e habilita fallback.
//   half_open  → após cooldown, deixa passar 1 sonda; sucesso fecha, falha reabre.

const KEY = "bgg";
const FAILURE_THRESHOLD = 3; // falhas consecutivas p/ abrir
const FAILURE_WINDOW_MS = 60_000; // janela p/ contar falhas consecutivas
const OPEN_COOLDOWN_MS = 120_000; // tempo aberto antes da sonda (half-open)

export type BreakerState = "closed" | "open" | "half_open";

interface BreakerRow {
  state: BreakerState;
  failures: number;
  opened_at: Date | null;
  updated_at: Date;
}

async function loadForUpdate(tx: Prisma.TransactionClient): Promise<BreakerRow> {
  await tx.$executeRaw`
    INSERT INTO circuit_breakers (key, state, failures, updated_at)
    VALUES (${KEY}, 'closed', 0, now())
    ON CONFLICT (key) DO NOTHING`;
  const rows = await tx.$queryRaw<BreakerRow[]>`
    SELECT state, failures, opened_at, updated_at
    FROM circuit_breakers WHERE key = ${KEY} FOR UPDATE`;
  return rows[0];
}

export interface AttemptDecision {
  /** true = pode chamar a BGG agora. */
  allowed: boolean;
  /** true = esta é a única sonda permitida no estado half-open. */
  isProbe: boolean;
}

/**
 * Decide, transacionalmente, se uma chamada à BGG deve ser tentada agora.
 * Transiciona open→half_open quando o cooldown expira (liberando 1 sonda).
 */
export async function canAttempt(): Promise<AttemptDecision> {
  return prisma.$transaction(
    async (tx) => {
      const row = await loadForUpdate(tx);
      const now = Date.now();

      if (row.state === "closed") return { allowed: true, isProbe: false };

      if (row.state === "open") {
        const openedFor = now - (row.opened_at?.getTime() ?? now);
        if (openedFor >= OPEN_COOLDOWN_MS) {
          await tx.$executeRaw`
            UPDATE circuit_breakers SET state = 'half_open', updated_at = now() WHERE key = ${KEY}`;
          return { allowed: true, isProbe: true };
        }
        return { allowed: false, isProbe: false };
      }

      // half_open: já há uma sonda em voo → segura as demais até resolver.
      return { allowed: false, isProbe: false };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted },
  );
}

/** Fecha o breaker (sucesso). Idempotente. */
export async function recordSuccess(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const row = await loadForUpdate(tx);
    if (row.state === "closed" && row.failures === 0) return;
    await tx.$executeRaw`
      UPDATE circuit_breakers
      SET state = 'closed', failures = 0, opened_at = NULL, updated_at = now()
      WHERE key = ${KEY}`;
  });
}

/**
 * Registra uma falha. Abre após FAILURE_THRESHOLD falhas consecutivas na janela,
 * ou imediatamente se a falha vier de uma sonda half-open. Emite
 * `bgg_fallback_acionado` na transição para open.
 */
export async function recordFailure(): Promise<void> {
  const openedNow = await prisma.$transaction(async (tx) => {
    const row = await loadForUpdate(tx);
    const now = Date.now();

    // sonda half-open falhou → reabre na hora
    if (row.state === "half_open") {
      await tx.$executeRaw`
        UPDATE circuit_breakers
        SET state = 'open', failures = ${FAILURE_THRESHOLD}, opened_at = now(), updated_at = now()
        WHERE key = ${KEY}`;
      return true;
    }
    if (row.state === "open") return false; // já aberto

    // closed: conta falhas consecutivas dentro da janela
    const withinWindow = now - row.updated_at.getTime() <= FAILURE_WINDOW_MS;
    const failures = (withinWindow ? row.failures : 0) + 1;
    if (failures >= FAILURE_THRESHOLD) {
      await tx.$executeRaw`
        UPDATE circuit_breakers
        SET state = 'open', failures = ${failures}, opened_at = now(), updated_at = now()
        WHERE key = ${KEY}`;
      return true;
    }
    await tx.$executeRaw`
      UPDATE circuit_breakers SET failures = ${failures}, updated_at = now() WHERE key = ${KEY}`;
    return false;
  });

  if (openedNow) {
    logger.warn({ msg: "bgg_breaker_opened" });
    await track("bgg_fallback_acionado", null, {});
  }
}

/** Leitura sem lock: a BGG está considerada fora? (open ou probando). */
export async function isBggDown(): Promise<boolean> {
  const row = await prisma.circuitBreaker.findUnique({ where: { key: KEY } });
  return row != null && row.state !== "closed";
}
