import NextAuth, { CredentialsSignin } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/server/db";
import { verifyPassword } from "@/server/auth/password";
import { loginSchema } from "@/shared/schemas";
import { authConfig } from "@/server/auth/config";

// BE-03 — login por senha em conta só-Google → mensagem "entre com Google"
class UseGoogleError extends CredentialsSignin {
  code = "use_google";
}
class InvalidCredentialsError extends CredentialsSignin {
  code = "invalid_credentials";
}

async function isProfileComplete(userId: string): Promise<boolean> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { completedAt: true },
  });
  return Boolean(profile?.completedAt);
}

// Google só entra quando as credenciais existem — registrar o provider sem
// client_id redireciona o usuário para um erro 400 do Google (bug de prod:
// tester clicava em "Cadastrar com Google" e voltava preso no /cadastro).
const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...(googleConfigured
      ? [
          Google({
            // BE-03 — mesmo e-mail → mesma conta (e-mail do Google já é verificado)
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new InvalidCredentialsError();
        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) throw new InvalidCredentialsError();
        if (!user.passwordHash) throw new UseGoogleError();
        const valid = await verifyPassword(user.passwordHash, password);
        if (!valid) throw new InvalidCredentialsError();
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // BE-01/BE-04 — claims userId + profileComplete no JWT; atualizado via
    // session.update() quando o perfil é salvo (trigger === "update").
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.userId = user.id;
        token.profileComplete = await isProfileComplete(user.id);
      } else if (trigger === "update" && typeof token.userId === "string") {
        token.profileComplete = await isProfileComplete(token.userId);
      }
      return token;
    },
  },
});
