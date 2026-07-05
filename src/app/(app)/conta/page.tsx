"use client";

// FE-13 — área conta/perfil (RF-05/10/28). Sem frame no Figma (§8 Gaps) —
// segue o design system. Exclusão em duas etapas: digitar "EXCLUIR" + senha.

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { useProfile, useCollection } from "@/lib/hooks";
import { api } from "@/lib/api";
import { usePageView } from "@/lib/track";

export default function AccountPage() {
  const { toast } = useToast();
  usePageView("conta");
  const { data: profile } = useProfile();
  const { data: collection } = useCollection();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const onDelete = async () => {
    setDeleting(true);
    try {
      await api("/api/account", {
        method: "DELETE",
        body: JSON.stringify({
          confirmation,
          password: password || undefined,
        }),
      });
      await signOut({ redirectTo: "/login" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao excluir a conta", "error");
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-2xl font-extrabold">Perfil</h1>

      <Card className="flex items-center gap-4">
        <Avatar name={profile?.displayName ?? "?"} photoUrl={profile?.photoUrl} size={64} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-bold">{profile?.displayName ?? "…"}</p>
          <p className="truncate text-xs text-muted">{profile?.email}</p>
          {profile && (
            <p className="mt-0.5 text-xs text-muted">
              📍 {profile.neighborhood ? `${profile.neighborhood}, ` : ""}
              {profile.city} · raio {profile.radiusKm} km
            </p>
          )}
        </div>
      </Card>

      <Card className="flex flex-col divide-y divide-line">
        <Link
          href="/perfil/configurar?edit=1"
          className="flex min-h-12 items-center justify-between py-3 text-sm font-semibold hover:text-primary-dark"
        >
          ✏️ Editar perfil, localização e raio <span aria-hidden>→</span>
        </Link>
        <Link
          href="/perfil/configurar?edit=1"
          className="flex min-h-12 items-center justify-between py-3 text-sm font-semibold hover:text-primary-dark"
        >
          🎲 Minha coleção ({collection?.length ?? 0} jogos) <span aria-hidden>→</span>
        </Link>
        <Link
          href="/termos"
          className="flex min-h-12 items-center justify-between py-3 text-sm font-semibold hover:text-primary-dark"
        >
          📄 Termos de Uso <span aria-hidden>→</span>
        </Link>
        <Link
          href="/privacidade"
          className="flex min-h-12 items-center justify-between py-3 text-sm font-semibold hover:text-primary-dark"
        >
          🔒 Política de Privacidade <span aria-hidden>→</span>
        </Link>
      </Card>

      <Button variant="outline" full onClick={() => signOut({ redirectTo: "/login" })}>
        Sair da conta
      </Button>

      <Button variant="danger" full onClick={() => setDeleteOpen(true)}>
        Excluir conta
      </Button>

      <BottomSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Excluir conta">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            Esta ação é <strong className="text-danger">irreversível</strong>: seu perfil, coleção,
            convites e matches serão apagados (LGPD). Seus dados de contato somem para os seus
            matches.
          </p>
          <Input
            label='Digite "EXCLUIR" para confirmar'
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            placeholder="EXCLUIR"
          />
          {profile?.hasPassword && (
            <Input
              label="Confirme sua senha"
              passwordToggle
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
            />
          )}
          <Button
            variant="danger"
            full
            disabled={confirmation !== "EXCLUIR" || (profile?.hasPassword && !password)}
            loading={deleting}
            onClick={onDelete}
          >
            Excluir minha conta definitivamente
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
