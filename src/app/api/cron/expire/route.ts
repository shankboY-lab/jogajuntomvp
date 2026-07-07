import { prisma } from "@/server/db";
import { ok, fail, withApi } from "@/server/http";
import { logger } from "@/server/logger";
import { track } from "@/server/events/track";

// DB-04/DB-11 — job idempotente chamado pelo Vercel Cron a cada hora (vercel.json),
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

  // DB-11 — expira grupos OPEN vencidos (RF-49). Idempotente: o updateMany com
  // filtro de status garante que só uma execução transiciona cada grupo.
  const expiring = await prisma.group.findMany({
    where: { status: "OPEN", expiresAt: { lt: new Date() } },
    include: { members: { select: { userId: true } } },
  });
  let expiredGroups = 0;
  for (const g of expiring) {
    const done = await prisma.$transaction(async (tx) => {
      const updated = await tx.group.updateMany({
        where: { id: g.id, status: "OPEN" },
        data: { status: "EXPIRED" },
      });
      if (updated.count === 0) return false; // já expirado por outra execução
      await tx.groupJoinRequest.updateMany({
        where: { groupId: g.id, status: "PENDING" },
        data: { status: "AUTO_DECLINED" },
      });
      const recipients = new Set<string>([g.creatorId, ...g.members.map((m) => m.userId)]);
      for (const uid of recipients) {
        await tx.notification.create({
          data: {
            userId: uid,
            type: "group_expired",
            payload: { groupId: g.id, groupName: g.name, gameId: g.gameId },
          },
        });
      }
      return true;
    });
    if (done) {
      expiredGroups++;
      await track("grupo_expirado", null, { groupId: g.id });
    }
  }

  logger.info({
    msg: "cron_expire",
    intents: intents.count,
    requests: requests.count,
    groups: expiredGroups,
  });
  return ok({
    expiredIntents: intents.count,
    expiredRequests: requests.count,
    expiredGroups,
  });
});
