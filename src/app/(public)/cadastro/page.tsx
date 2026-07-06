"use client";

// FE-04 — tela de cadastro (v2-02): Google, e-mail, senha (hint ">= 8"),
// confirmar senha (blur), 409 inline (RF-03)

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";
import { GoogleAuthSection } from "@/components/GoogleButton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { api, ApiClientError } from "@/lib/api";
import { usePageView } from "@/lib/track";

export default function SignupPage() {
  const router = useRouter();
  usePageView("cadastro");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; confirm?: string }>({});
  const [loading, setLoading] = useState(false);

  const validateConfirm = () => {
    setErrors((prev) => ({
      ...prev,
      confirm: confirm && confirm !== password ? "As senhas não coincidem" : undefined,
    }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "E-mail inválido";
    if (password.length < 8) next.password = "Use ao menos 8 caracteres";
    if (confirm !== password) next.confirm = "As senhas não coincidem";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      // auto-login após criação (BE-02); se falhar, conta existe → vai ao login
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        router.push("/login");
        return;
      }
      router.push("/perfil/configurar");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setErrors({ email: "Este e-mail já está cadastrado. Tente entrar." });
      } else {
        setErrors({ email: err instanceof Error ? err.message : "Erro ao criar conta" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Logo />

      <GoogleAuthSection label="Cadastrar com Google" />

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="E-mail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="voce@exemplo.com"
          error={errors.email}
        />
        <Input
          label="Senha"
          passwordToggle
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Crie uma senha"
          hint="Use ao menos 8 caracteres"
          error={errors.password}
        />
        <Input
          label="Confirmar senha"
          passwordToggle
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={validateConfirm}
          placeholder="Repita a senha"
          error={errors.confirm}
        />
        <Button type="submit" full loading={loading}>
          Criar conta
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-primary-dark hover:underline">
          Entrar
        </Link>
      </p>

      <p className="text-center text-xs text-muted">
        Ao criar a conta você aceita os{" "}
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
