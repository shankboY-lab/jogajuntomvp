import type { NextAuthConfig } from "next-auth";

/**
 * BE-01/BE-04 — parte edge-safe da configuração (usada pelo middleware).
 * Nada aqui pode importar Prisma: o middleware roda no edge runtime.
 * Os callbacks que tocam o banco vivem em src/server/auth/index.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 dias, rotação a cada uso (BE-05)
    updateAge: 24 * 60 * 60,
  },
  providers: [],
  callbacks: {
    session({ session, token }) {
      if (token.userId) session.user.id = token.userId as string;
      session.profileComplete = Boolean(token.profileComplete);
      return session;
    },
  },
} satisfies NextAuthConfig;
