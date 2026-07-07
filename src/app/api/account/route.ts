import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { verifyPassword } from "@/server/auth/password";
import { accountDeleteSchema } from "@/shared/schemas";

// BE-17/DB-05/DB-12 — DELETE /api/account: exclusão LGPD em cascata (RF-28/54).
// FKs onDelete Cascade apagam UserGame, PlayIntent, InterestRequest, Match,
// Profile, Account, grupos criados e memberships; Event.userId e
// games.created_by_id → null (SetNull) preservam métricas e o catálogo anônimo.
// Antes do delete: notifica participantes e reabre vagas afetadas (RF-54).
export const DELETE = withApi("account.delete", async (req) => {
  const { userId } = await requireUser();
  const body = accountDeleteSchema.parse(await req.json());

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return fail(404, "user_not_found", "Usuário não encontrado.");

  // reautenticação: senha quando existe; conta só-Google confirma com o texto
  if (user.passwordHash) {
    if (!body.password || !(await verifyPassword(user.passwordHash, body.password))) {
      return fail(403, "reauth_failed", "Senha incorreta.");
    }
  }

  await prisma.$transaction(async (tx) => {
    // (1) grupos criados pelo usuário → notifica membros (o grupo some por cascade)
    const createdGroups = await tx.group.findMany({
      where: { creatorId: userId },
      include: { members: { select: { userId: true } } },
    });
    for (const g of createdGroups) {
      for (const m of g.members) {
        await tx.notification.create({
          data: {
            userId: m.userId,
            type: "group_cancelled",
            payload: { groupId: g.id, groupName: g.name, gameId: g.gameId },
          },
        });
      }
    }

    // (2) memberships em grupos de terceiros → reabre vaga (FULL→OPEN) + notifica
    const memberships = await tx.groupMember.findMany({
      where: { userId, group: { creatorId: { not: userId } } },
      include: { group: true },
    });
    for (const m of memberships) {
      const g = m.group;
      if (g.status === "FULL" && g.expiresAt > new Date()) {
        await tx.group.update({ where: { id: g.id }, data: { status: "OPEN" } });
      }
      const remaining = await tx.groupMember.findMany({
        where: { groupId: g.id, userId: { not: userId } },
        select: { userId: true },
      });
      const recipients = new Set<string>([g.creatorId, ...remaining.map((r) => r.userId)]);
      for (const uid of recipients) {
        await tx.notification.create({
          data: {
            userId: uid,
            type: "member_left",
            payload: { groupId: g.id, groupName: g.name, gameId: g.gameId, userId },
          },
        });
      }
    }

    // (3) exclusão em cascata (games.created_by_id → null via SetNull)
    await tx.user.delete({ where: { id: userId } });
  });

  // o cliente chama signOut() na sequência (FE-13)
  return ok({ deleted: true });
});
