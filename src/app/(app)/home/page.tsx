"use client";

// FE-08 — home com dois modos (v2-05, RF-16):
// modo A "Quero jogar" — chips da coleção, tocar dispara busca (cria intent);
// modo B "Buscar jogos" — reusa o autocomplete BGG sem adicionar à coleção.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { GameChip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { GameSearch } from "@/components/GameSearch";
import { useProfile, useCollection, useInbox } from "@/lib/hooks";
import { usePageView } from "@/lib/track";

const VISIBLE_CHIPS = 6;

export default function HomePage() {
  const router = useRouter();
  usePageView("home");
  const { data: profile } = useProfile();
  const { data: collection, isLoading: loadingCollection } = useCollection();
  const { data: inbox } = useInbox();
  const [showAll, setShowAll] = useState(false);

  const games = collection ?? [];
  const visible = showAll ? games : games.slice(0, VISIBLE_CHIPS);
  const pendingCount = inbox?.counts.received ?? 0;

  return (
    <div className="flex flex-col gap-5 pb-6">
      {/* Header: saudação + sino (abre /convites — §8 Gaps item 3) + avatar */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">
          Olá, {profile?.displayName?.split(" ")[0] ?? "…"} <span aria-hidden>👋</span>
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/convites"
            aria-label={pendingCount > 0 ? `${pendingCount} convites pendentes` : "Convites"}
            className="relative flex size-11 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <span aria-hidden>🔔</span>
            {pendingCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {pendingCount > 9 ? "9+" : pendingCount}
              </span>
            )}
          </Link>
          <Link href="/conta" aria-label="Meu perfil">
            <Avatar name={profile?.displayName ?? "?"} photoUrl={profile?.photoUrl} size={44} />
          </Link>
        </div>
      </header>

      {/* pill de localização */}
      {profile && (
        <Link
          href="/perfil/configurar?edit=1"
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-muted shadow-sm hover:text-ink"
        >
          📍 {profile.neighborhood ? `${profile.neighborhood}, ` : ""}
          {profile.city} · {profile.radiusKm} km
        </Link>
      )}

      {/* Modo A — Quero jogar */}
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">Quero jogar</h2>
          <p className="text-xs text-muted">
            Toque num jogo da sua coleção para achar quem também quer jogar.
          </p>
        </div>
        {loadingCollection ? (
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-32 rounded-full" />
            <Skeleton className="h-11 w-40 rounded-full" />
            <Skeleton className="h-11 w-28 rounded-full" />
          </div>
        ) : games.length === 0 ? (
          <EmptyState
            title="Sua coleção está vazia"
            description="Adicione jogos no seu perfil para começar."
          >
            <Link
              href="/perfil/configurar?edit=1"
              className="text-sm font-semibold text-primary-dark hover:underline"
            >
              Adicionar jogos →
            </Link>
          </EmptyState>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {visible.map((g) => (
                <GameChip
                  key={g.bggId}
                  name={g.name}
                  thumbnailUrl={g.thumbnailUrl}
                  active={g.intentActive}
                  onClick={() => router.push(`/busca/${g.bggId}?mode=A`)}
                />
              ))}
            </div>
            {games.length > VISIBLE_CHIPS && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="self-start text-sm font-semibold text-primary-dark hover:underline"
              >
                {showAll ? "Ver menos" : `Ver todos (${games.length})`}
              </button>
            )}
          </>
        )}
      </Card>

      <div aria-hidden className="flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs font-medium text-muted">ou</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      {/* Modo B — Buscar jogos */}
      <Card className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-bold">Buscar jogos</h2>
          <p className="text-xs text-muted">
            Procure qualquer jogo — mesmo que você ainda não tenha.
          </p>
        </div>
        <GameSearch
          mode="search"
          onConfirm={(game) => router.push(`/busca/${game.bggId}?mode=B`)}
        />
      </Card>
    </div>
  );
}
