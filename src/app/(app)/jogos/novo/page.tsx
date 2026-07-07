"use client";

/* eslint-disable @next/next/no-img-element */

// FE-17 — cadastro manual de jogo (v3-06/v3-07). Só existe como saída do estado
// de exceção do GameSearch (BGG fora E zero resultados). O gatilho é revalidado
// no servidor (403 manual_disabled); a UI cai fora se a BGG voltou.

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { useCreateManualGame, useAddGame } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api";
import { usePageView } from "@/lib/track";
import { isFeatureEnabled } from "@/shared/flags";
import { manualGameSchema } from "@/shared/schemas";
import type { GameSummary } from "@/shared/types";

function ManualGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  usePageView("jogo_novo");

  const createGame = useCreateManualGame();
  const addGame = useAddGame();

  const [name, setName] = useState(searchParams.get("name") ?? "");
  const [year, setYear] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [candidates, setCandidates] = useState<GameSummary[] | null>(null);

  // flag off → esta rota não existe para o usuário (INF-08).
  useEffect(() => {
    if (!isFeatureEnabled("manualGames")) router.replace("/home");
  }, [router]);

  const onCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("A capa precisa ter no máximo 2 MB.", "error");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { url } = await api<{ url: string }>("/api/games/cover", {
        method: "POST",
        body: form,
      });
      setCoverUrl(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro no upload da capa", "error");
    } finally {
      setUploading(false);
    }
  };

  const buildInput = (force: boolean) => ({
    name,
    yearPublished: year.trim() ? Number(year) : null,
    minPlayers: minPlayers.trim() ? Number(minPlayers) : null,
    maxPlayers: maxPlayers.trim() ? Number(maxPlayers) : null,
    coverUrl,
    force,
  });

  const submit = async (force: boolean) => {
    setErrors({});
    const parsed = manualGameSchema.safeParse(buildInput(force));
    if (!parsed.success) {
      const map: Record<string, string> = {};
      for (const issue of parsed.error.issues) map[issue.path.join(".")] = issue.message;
      setErrors(map);
      return;
    }
    try {
      const { game } = await createGame.mutateAsync(parsed.data);
      toast(`${game.name} criado e adicionado à sua coleção!`, "success");
      router.push("/conta");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        const body = err.extra as { error?: { candidates?: GameSummary[] } };
        setCandidates(body?.error?.candidates ?? []);
        return;
      }
      if (err instanceof ApiClientError && err.status === 403) {
        toast("O BoardGameGeek voltou — busque o jogo normalmente.", "info");
        router.replace("/home");
        return;
      }
      toast(err instanceof Error ? err.message : "Erro ao criar o jogo", "error");
    }
  };

  const pickCandidate = async (g: GameSummary) => {
    try {
      await addGame.mutateAsync(g.bggId != null ? { bggId: g.bggId } : { gameId: g.gameId });
      toast(`${g.name} adicionado à sua coleção!`, "success");
      router.push("/conta");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao adicionar jogo", "error");
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
        <div>
          <h1 className="text-xl font-extrabold">Cadastrar jogo</h1>
          <p className="text-xs text-muted">Quando o BoardGameGeek está fora do ar</p>
        </div>
      </header>

      <p className="rounded-input bg-cream-dark px-3.5 py-2.5 text-xs font-medium text-primary-dark">
        Este jogo entra com o selo <strong>da comunidade</strong> e vai direto para a sua coleção.
      </p>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center overflow-hidden rounded-md bg-cream-dark">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="size-16 object-cover" />
            ) : (
              <span aria-hidden className="text-2xl">
                🎲
              </span>
            )}
          </div>
          <label className="cursor-pointer text-sm font-semibold text-primary-dark hover:underline">
            {uploading ? "Enviando…" : coverUrl ? "Trocar capa" : "Adicionar capa (opcional)"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onCoverChange}
              disabled={uploading}
            />
          </label>
        </div>

        <Input
          label="Nome do jogo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex.: Banco Imobiliário"
          maxLength={80}
          error={errors.name}
          required
        />
        <Input
          label="Ano (opcional)"
          type="number"
          inputMode="numeric"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="Ex.: 2021"
          error={errors.yearPublished}
        />
        <div className="flex gap-3">
          <Input
            label="Mín. jogadores"
            type="number"
            inputMode="numeric"
            value={minPlayers}
            onChange={(e) => setMinPlayers(e.target.value)}
            placeholder="1"
            error={errors.minPlayers}
          />
          <Input
            label="Máx. jogadores"
            type="number"
            inputMode="numeric"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(e.target.value)}
            placeholder="4"
            error={errors.maxPlayers}
          />
        </div>
      </Card>

      <Button
        full
        loading={createGame.isPending}
        disabled={name.trim().length < 3 || uploading}
        onClick={() => submit(false)}
      >
        Cadastrar e adicionar à coleção
      </Button>

      <BottomSheet
        open={candidates !== null}
        onClose={() => setCandidates(null)}
        title="Será que já temos esse jogo?"
      >
        <p className="mb-3 text-sm text-muted">
          Achamos jogos parecidos. Se for um destes, é só escolher — evita duplicar o catálogo.
        </p>
        <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto">
          {(candidates ?? []).map((g) => (
            <li key={g.gameId}>
              <button
                type="button"
                onClick={() => pickCandidate(g)}
                className="flex w-full items-center gap-3 rounded-input border border-line bg-white p-2.5 text-left hover:border-primary/50"
              >
                {g.thumbnailUrl ? (
                  <img src={g.thumbnailUrl} alt="" className="size-11 rounded-md object-cover" />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-11 items-center justify-center rounded-md bg-cream-dark"
                  >
                    🎲
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{g.name}</span>
                  <span className="text-xs text-muted">
                    {g.yearPublished ?? "—"}
                    {g.source === "USER_CREATED" ? " · da comunidade" : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4">
          <Button
            full
            variant="outline"
            loading={createGame.isPending}
            onClick={() => {
              setCandidates(null);
              void submit(true);
            }}
          >
            Nenhum destes — cadastrar mesmo assim
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}

export default function ManualGamePage() {
  return (
    <Suspense>
      <ManualGameForm />
    </Suspense>
  );
}
