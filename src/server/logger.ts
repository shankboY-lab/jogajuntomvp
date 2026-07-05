import pino from "pino";

// INF-05 — logger estruturado; em produção sai JSON puro (coletado pela Vercel)
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: undefined,
  redact: ["password", "passwordHash", "*.password", "*.passwordHash"],
});

export function requestLogger(requestId: string, route: string) {
  return logger.child({ requestId, route });
}
