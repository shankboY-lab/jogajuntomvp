import { prisma } from "@/server/db";
import { ok, fail, withApi } from "@/server/http";
import { logger } from "@/server/logger";

// DB-04 — job idempotente chamado pelo Vercel Cron a cada hora (vercel.json),
// protegido por CRON_SECRET. Execução dupla não altera estado duas vezes.
export const GET = withApi("cron.expire", async (req) => {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return fail(401, "unauthorized", "Segredo do cron inválido.");
  }

  const requestTtlDays = Number(process.env.REQUEST_TTL_DAYS ?? 7);
  const requestCutoff = new Date(Date.now() - requestTtlDays * 24 * 60 * 60 * 1000);

  const [intents, requests] = await prisma.$transaction([
    prisma.playIntent.updateMany({
      where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    }),
    prisma.interestRequest.updateMany({
      where: { status: "PENDING", createdAt: { lt: requestCutoff } },
      data: { status: "EXPIRED" },
    }),
  ]);

  logger.info({ msg: "cron_expire", intents: intents.count, requests: requests.count });
  return ok({ expiredIntents: intents.count, expiredRequests: requests.count });
});
