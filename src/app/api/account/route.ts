import { prisma } from "@/server/db";
import { ok, fail, withApi, requireUser } from "@/server/http";
import { verifyPassword } from "@/server/auth/password";
import { accountDeleteSchema } from "@/shared/schemas";

// BE-17/DB-05 — DELETE /api/account: exclusão LGPD em cascata (RF-28, RNF-08).
// FKs com onDelete: Cascade apagam UserGame, PlayIntent, InterestRequest,
// Match (ambas as direções), Profile e Account; Event.userId → null (SetNull)
// preserva métricas agregadas anonimizadas.
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

  await prisma.user.delete({ where: { id: userId } });

  // o cliente chama signOut() na sequência (FE-13)
  return ok({ deleted: true });
});
