"use client";

/* eslint-disable @next/next/no-img-element */

// FE-07 — autocomplete BGG (debounce 500ms, mín 3 chars) + bottom sheet
// "É este jogo?" (v2-04) com badge "Resultados do BoardGameGeek".
// Nenhuma chamada direta do browser à BGG — tudo via /api/bgg/* (RNF-05).

import { useEffect, useRef, useState } from "react";
import { useBggSearch, useBggThing } from "@/lib/hooks";
import { ApiClientError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BggSearchItem, GameSummary } from "@/shared/types";

export function GameSearch({
  mode,
  onConfirm,
  confirmLabelPrefix = "Adicionar",
  placeholder = "Busque um jogo — ex.: Catan",
  disabledIds = [],
}: {
  /** collect = adicionar à coleção (v2-03); search = só navegar (modo B, v2-05) */
  mode: "collect" | "search";
  onConfirm: (game: GameSummary) => void | Promise<void>;
  confirmLabelPrefix?: string;
  placeholder?: string;
  disabledIds?: number[];
}) {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
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

  const searchQuery = useBggSearch(debounced, true);
  const items = searchQuery.data ?? [];

  useEffect(() => {
    if (debounced.trim().length >= 3 && (searchQuery.isSuccess || searchQuery.isError)) {
      setSheetOpen(true);
    }
  }, [debounced, searchQuery.isSuccess, searchQuery.isError]);

  // detalhes (ano + capa) para desambiguação — batch de até 20 ids (BE-09)
  const detailIds = sheetOpen ? items.slice(0, 10).map((i) => i.bggId) : [];
  const thingQuery = useBggThing(detailIds);
  const details = new Map((thingQuery.data ?? []).map((g) => [g.bggId, g]));

  const close = () => {
    setSheetOpen(false);
    setSelected(null);
  };

  const selectedGame: GameSummary | null =
    selected != null
      ? (details.get(selected) ?? toSummary(items.find((i) => i.bggId === selected)))
      : null;

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

  const bggDown = searchQuery.isError;
  const retryAfter =
    searchQuery.error instanceof ApiClientError
      ? ((searchQuery.error.extra?.error as { retryAfter?: number })?.retryAfter ?? null)
      : null;

  return (
    <div>
      <div className="relative">
        <Input
          role="combobox"
          aria-expanded={sheetOpen}
          aria-label="Buscar jogo no BoardGameGeek"
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
        <span className="mb-3 inline-flex items-center gap-1 rounded-full bg-cream-dark px-2.5 py-1 text-[11px] font-semibold text-primary-dark">
          Resultados do BoardGameGeek
        </span>

        {searchQuery.isFetching && (
          <div className="flex flex-col gap-2" aria-busy>
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        )}

        {bggDown && !searchQuery.isFetching && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted">
              O BoardGameGeek está indisponível no momento.
              {retryAfter ? ` Tente de novo em ~${retryAfter}s.` : ""}
            </p>
            <Button variant="outline" onClick={() => searchQuery.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!bggDown && !searchQuery.isFetching && items.length === 0 && (
          <p className="py-6 text-center text-sm text-muted">
            Não encontramos esse jogo. Confira a grafia ou tente um termo mais curto.
          </p>
        )}

        {!bggDown && !searchQuery.isFetching && items.length > 0 && (
          <ul className="flex max-h-[45dvh] flex-col gap-2 overflow-y-auto" role="listbox">
            {items.map((item) => {
              const detail = details.get(item.bggId);
              const isSelected = selected === item.bggId;
              const inCollection = disabledIds.includes(item.bggId);
              return (
                <li key={item.bggId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={inCollection}
                    onClick={() => setSelected(item.bggId)}
                    className={`flex w-full items-center gap-3 rounded-input border p-2.5 text-left transition-colors disabled:opacity-50 ${
                      isSelected
                        ? "border-primary bg-cream-dark"
                        : "border-line bg-white hover:border-primary/50"
                    }`}
                  >
                    {detail?.thumbnailUrl ? (
                      <img
                        src={detail.thumbnailUrl}
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
                    <span className="flex-1">
                      <span className="block text-sm font-semibold">{item.name}</span>
                      <span className="block text-xs text-muted">
                        {item.yearPublished ?? detail?.yearPublished ?? "—"} · Jogo base
                        {inCollection ? " · já na coleção" : ""}
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

function toSummary(item: BggSearchItem | undefined): GameSummary | null {
  if (!item) return null;
  return { ...item, thumbnailUrl: null };
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}
