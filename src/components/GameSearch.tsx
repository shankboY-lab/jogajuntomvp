"use client";

/* eslint-disable @next/next/no-img-element */

// FE-07 + FE-16 — autocomplete de catálogo (debounce 500ms, mín 3 chars) +
// bottom sheet "É este jogo?" (v2-04 / v3-04 / v3-05). Consome /api/games/search
// (BGG + banco reserva). Nenhuma chamada direta do browser à BGG (RNF-05).
//   · itens USER_CREATED ganham selo "da comunidade";
//   · bggDown → badge âmbar "BoardGameGeek fora do ar — mostrando a nossa base";
//   · canCreateManual → CTA "Cadastrar jogo manualmente" (só existe no DOM aqui).

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameSearch, useBggThing } from "@/lib/hooks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import { trackEvent } from "@/lib/track";
import type { GameSearchItem, GameSummary } from "@/shared/types";

function itemKey(item: GameSearchItem): string {
  return item.gameId ?? `bgg:${item.bggId}`;
}

export function GameSearch({
  mode,
  onConfirm,
  confirmLabelPrefix = "Adicionar",
  placeholder = "Busque um jogo — ex.: Catan",
  disabledKeys = [],
}: {
  /** collect = adicionar à coleção (v2-03); search = só navegar (modo B, v2-05) */
  mode: "collect" | "search";
  onConfirm: (game: GameSummary) => void | Promise<void>;
  confirmLabelPrefix?: string;
  placeholder?: string;
  /** chaves (gameId ou `bgg:{bggId}`) já na coleção — desabilita no resultado */
  disabledKeys?: string[];
}) {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounce 500 ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebounced(term), 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term]);

  const searchQuery = useGameSearch(debounced, true);
  const items = searchQuery.data?.items ?? [];
  const bggDown = searchQuery.data?.bggDown ?? false;
  const canCreateManual = searchQuery.data?.canCreateManual ?? false;

  useEffect(() => {
    if (debounced.trim().length >= 3 && (searchQuery.isSuccess || searchQuery.isError)) {
      setSheetOpen(true);
    }
  }, [debounced, searchQuery.isSuccess, searchQuery.isError]);

  // detalhes (ano + capa + gameId) só para itens BGG ainda não materializados
  // (resultados ao vivo, sem gameId). Itens do reserva já vêm com gameId.
  const detailIds = sheetOpen
    ? items.filter((i) => i.gameId == null && i.bggId != null).map((i) => i.bggId as number)
    : [];
  const thingQuery = useBggThing(detailIds);
  const details = new Map((thingQuery.data ?? []).map((g) => [g.bggId as number, g]));

  const close = () => {
    setSheetOpen(false);
    setSelectedKey(null);
  };

  const selectedItem = items.find((i) => itemKey(i) === selectedKey) ?? null;
  // itens já materializados (reserva / USER_CREATED) trazem gameId; BGG ao vivo
  // precisa do thing materializado p/ obter o gameId canônico.
  const selectedGame: GameSummary | null = !selectedItem
    ? null
    : selectedItem.gameId
      ? {
          gameId: selectedItem.gameId,
          bggId: selectedItem.bggId,
          name: selectedItem.name,
          yearPublished: selectedItem.yearPublished,
          thumbnailUrl: selectedItem.thumbnailUrl,
          source: selectedItem.source,
        }
      : (details.get(selectedItem.bggId as number) ?? null);

  const handleConfirm = async () => {
    if (!selectedGame) return;
    setConfirming(true);
    try {
      await onConfirm(selectedGame);
      close();
      setTerm("");
      setDebounced("");
    } finally {
      setConfirming(false);
    }
  };

  const goToManual = () => {
    trackEvent("cta_manual_clicado", { term: debounced });
    close();
    router.push(`/jogos/novo?name=${encodeURIComponent(debounced)}`);
  };

  return (
    <div>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={sheetOpen}
          aria-label="Buscar jogo"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {searchQuery.isFetching && (
          <span
            aria-label="Buscando…"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-primary border-t-transparent"
          />
        )}
      </div>

      <BottomSheet open={sheetOpen} onClose={close} title="É este jogo?">
        {bggDown ? (
          <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
            ⚠️ BoardGameGeek fora do ar — mostrando a nossa base
          </span>
        ) : (
          <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-cream-dark px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
            Resultados do BoardGameGeek
          </span>
        )}

        {searchQuery.isFetching && (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}

        {!searchQuery.isFetching && canCreateManual && (
          // v3-05 — BGG fora E zero resultados: único caminho p/ o cadastro manual
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted">
              Não achamos “{debounced}” na nossa base e o BoardGameGeek está fora do ar.
            </p>
            <Button full onClick={goToManual}>
              Cadastrar jogo manualmente
            </Button>
            <Button variant="outline" onClick={() => searchQuery.refetch()}>
              Tentar de novo
            </Button>
          </div>
        )}

        {!searchQuery.isFetching && !canCreateManual && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            Não encontramos esse jogo. Confira a grafia ou tente um termo mais curto.
          </p>
        )}

        {!searchQuery.isFetching && items.length > 0 && (
          <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto" role="listbox">
            {items.map((item) => {
              const key = itemKey(item);
              const detail = item.bggId != null ? details.get(item.bggId) : undefined;
              const thumb = item.thumbnailUrl ?? detail?.thumbnailUrl ?? null;
              const isSelected = selectedKey === key;
              const inCollection = disabledKeys.includes(key);
              const isCommunity = item.source === "USER_CREATED";
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={inCollection}
                    onClick={() => setSelectedKey(key)}
                    className={`flex w-full items-center gap-3 rounded-input border p-2.5 text-left transition-colors disabled:opacity-50 ${
                      isSelected
                        ? "border-primary bg-cream-dark"
                        : "border-line bg-white hover:border-primary/50"
                    }`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        width={44}
                        height={44}
                        className="size-11 rounded-md object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex size-11 items-center justify-center rounded-md bg-cream-dark"
                      >
                        🎲
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{item.name}</span>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <span>{item.yearPublished ?? detail?.yearPublished ?? "—"}</span>
                        {isCommunity && (
                          <span className="rounded-full bg-cream-dark px-1.5 py-0.5 text-[10px] font-semibold text-primary-dark">
                            da comunidade
                          </span>
                        )}
                        {inCollection && <span>· já na coleção</span>}
                      </span>
                    </span>
                    {isSelected && (
                      <span
                        aria-hidden
                        className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selectedGame && (
          <div className="mt-4">
            <Button full loading={confirming} onClick={handleConfirm}>
              {mode === "collect"
                ? `${confirmLabelPrefix} ${truncate(selectedGame.name, 24)} à coleção`
                : `Buscar quem quer jogar ${truncate(selectedGame.name, 24)}`}
            </Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
