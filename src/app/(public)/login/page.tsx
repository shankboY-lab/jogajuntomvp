"use client";

// FE-03 — tela de login (v2-01): Google, divisor "ou", e-mail/senha com
// toggle de visibilidade, erros inline, links Termos/Privacidade (RF-01/02)

import { useState, Suspense } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/Logo";
import { GoogleAuthSection } from "@/components/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePageView } from "@/lib/track";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  usePageView("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Auth.js redireciona para cá com ?error= quando um fluxo OAuth falha
  const urlError = searchParams.get("error");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError(
        res.code === "use_google"
          ? "Esta conta usa o Google — toque em “Continuar com Google”."
          : "E-mail ou senha incorretos.",
      );
      return;
    }
    router.push(searchParams.get("callbackUrl") ?? "/home");
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-6">
      <Logo />

      {urlError && !error && (
        <p
          role="alert"
          className="rounded-input bg-red-50 px-4 py-3 text-sm font-medium text-danger"
        >
          Não foi possível entrar por esse método. Tente com e-mail e senha.
        </p>
      )}

      <GoogleAuthSection label="Continuar com Google" />

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
        />
        <Input
          label="Senha"
          passwordToggle
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Sua senha"
          error={error}
        />
        <Button type="submit" full loading={loading}>
          Entrar
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-semibold text-primary-dark hover:underline">
          Criar conta
        </Link>
      </p>

      <p className="text-center text-xs text-muted">
        Ao continuar você concorda com os{" "}
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>{" "}
        e a{" "}
        <Link href="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        .
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
