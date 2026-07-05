import { prisma } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { ok, fail, withApi, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";
import { track } from "@/server/events/track";
import { signupSchema } from "@/shared/schemas";

// BE-02 — cadastro e-mail/senha (RF-03, RNF-06)
export const POST = withApi("auth/signup", async (req) => {
  await assertIpLimit(clientIp(req), "signup", 5, 60);

  const body = signupSchema.parse(await req.json());

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    return fail(409, "email_taken", "Este e-mail já está cadastrado. Tente entrar.");
  }

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: { email: body.email, passwordHash },
  });

  await track("signup_completed", user.id, { method: "credentials" });
  // auto-login: o cliente chama signIn("credentials") na sequência (FE-04)
  return ok({ id: user.id, email: user.email }, { status: 201 });
});
