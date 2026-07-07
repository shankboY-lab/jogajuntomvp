"use client";

// FE-21 — criar grupo (v3-08, RF-41). Entra por "Criar grupo para este jogo"
// (resultados modo A) ou pela coleção em /conta. O jogo tem de estar na coleção.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { ApiClientError } from "@/lib/api";
import { useCollection, useCreateGroup } from "@/lib/hooks";
import { usePageView } from "@/lib/track";
import { isFeatureEnabled } from "@/shared/flags";
import { groupCreateSchema } from "@/shared/schemas";

function CreateGroupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const gameId = params.get("gameId") ?? "";
  const { toast } = useToast();
  usePageView("grupo_novo");

  const { data: collection } = useCollection();
  const createGroup = useCreateGroup();
  const game = collection?.find((g) => g.gameId === gameId);

  const [name, setName] = useState("");
  const [slots, setSlots] = useState(3);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFeatureEnabled("groups")) router.replace("/home");
  }, [router]);

  const submit = async () => {
    setError(null);
    const parsed = groupCreateSchema.safeParse({ gameId, name, slots });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    try {
      const { groupId } = await createGroup.mutateAsync(parsed.data);
      toast("Grupo criado! Compartilhe e receba os pedidos.", "success");
      router.push(`/grupos/${groupId}`);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "too_many_open_groups") {
        setError(err.message);
        return;
      }
      toast(err instanceof Error ? err.message : "Erro ao criar o grupo", "error");
    }
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm"
        >
          ←
        </button>
        <h1 className="text-xl font-extrabold">Criar grupo</h1>
      </header>

      {game ? (
        <Card className="flex items-center gap-3">
          {game.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.thumbnailUrl} alt="" className="size-12 rounded-md object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-md bg-cream-dark text-xl"
            >
              🎲
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-bold">{game.name}</p>
            <p className="text-xs text-muted">{game.yearPublished ?? "—"}</p>
          </div>
        </Card>
      ) : (
        <p className="rounded-input bg-cream-dark px-3.5 py-2.5 text-sm text-primary-dark">
          Escolha um jogo da sua coleção para criar um grupo.
        </p>
      )}

      <Card className="flex flex-col gap-4">
        <Input
          label="Nome do grupo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Mesa de sexta à noite"
          maxLength={50}
        />

        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted">Vagas</label>
          <div className="mt-2 flex items-center gap-4">
            <button
              type="button"
              aria-label="Menos vagas"
              onClick={() => setSlots((s) => Math.max(1, s - 1))}
              className="flex size-11 items-center justify-center rounded-full border border-line text-lg font-bold hover:border-primary disabled:opacity-40"
              disabled={slots <= 1}
            >
              −
            </button>
            <span className="w-8 text-center text-2xl font-extrabold" aria-live="polite">
              {slots}
            </span>
            <button
              type="button"
              aria-label="Mais vagas"
              onClick={() => setSlots((s) => Math.min(9, s + 1))}
              className="flex size-11 items-center justify-center rounded-full border border-line text-lg font-bold hover:border-primary disabled:opacity-40"
              disabled={slots >= 9}
            >
              +
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            Mesa de <strong className="text-ink">{slots + 1} jogadores</strong> no total, contando
            você.
          </p>
        </div>
      </Card>

      <p className="rounded-input bg-cream-dark px-3.5 py-2.5 text-xs font-medium text-primary-dark">
        ⏳ O grupo expira em 14 dias. 🔒 Os pedidos só viram contato depois que você aceitar (vira
        um match).
      </p>

      {error && <p className="text-sm font-medium text-danger">{error}</p>}

      <Button
        full
        loading={createGroup.isPending}
        disabled={!game || name.trim().length < 3}
        onClick={submit}
      >
        Criar grupo
      </Button>
    </div>
  );
}

export default function CreateGroupPage() {
  return (
    <Suspense>
      <CreateGroupForm />
    </Suspense>
  );
}
