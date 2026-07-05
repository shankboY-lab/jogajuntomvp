import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/server/auth/config";

// BE-04 — roteamento por estado da conta (RF-04, fluxograma do PRD §8):
//  sem sessão → /login; sessão + perfil incompleto → /perfil/configurar;
//  completo acessando /login|/cadastro → /home.
// APIs não passam por aqui (retornam 401 JSON via requireUser).

const { auth } = NextAuth(authConfig);

const PUBLIC_ROUTES = new Set(["/login", "/cadastro", "/termos", "/privacidade"]);
const AUTH_ROUTES = new Set(["/login", "/cadastro"]);

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth?.user);
  const profileComplete = Boolean(req.auth?.profileComplete);

  const redirect = (to: string) => NextResponse.redirect(new URL(to, nextUrl));

  if (pathname === "/") {
    if (!isLoggedIn) return redirect("/login");
    return redirect(profileComplete ? "/home" : "/perfil/configurar");
  }

  if (!isLoggedIn) {
    if (PUBLIC_ROUTES.has(pathname)) return NextResponse.next();
    const login = new URL("/login", nextUrl);
    login.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (AUTH_ROUTES.has(pathname)) {
    return redirect(profileComplete ? "/home" : "/perfil/configurar");
  }

  if (!profileComplete && !PUBLIC_ROUTES.has(pathname) && pathname !== "/perfil/configurar") {
    return redirect("/perfil/configurar");
  }

  return NextResponse.next();
});

export const config = {
  // só páginas: exclui /api, assets estáticos e arquivos
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
