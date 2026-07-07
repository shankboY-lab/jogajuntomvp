"use client";

// FE-19 — /explorar (v3-02, RF-37/38/40): busca modo C paginada com scroll
// infinito. Reusa o card de resultado da v2 com a linha "Quer jogar:" (jogo em
// comum destacado). FE-20 — sheet "Jogar o quê?" quando a pessoa quer >1 jogo.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextChip } from "@/components/ui/Chip";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useToast } from "@/components/ui/Toast";
import { GroupResultCard } from "@/components/GroupResultCard";
import { useExplore, useSendInterest, useProfile } from "@/lib/hooks";
import { usePageView, trackEvent } from "@/lib/track";
import { RADIUS_OPTIONS } from "@/shared/schemas";
import type {
  ExploreEntry,
  ExploreResultItem,
  ExploreWantItem,
  GroupResultItem,
} from "@/shared/types";

function isGroup(item: ExploreEntry): item is GroupResultItem {
  return "type" in item && item.type === "group";
}

export default function ExplorePage() {
  const router = useRouter();
  const { toast } = useToast();
  usePageView("explorar");

  const { data: profile } = useProfile();
  const [radiusOverride, setRadiusOverride] = useState<number | undefined>(undefined);
  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useExplore(radiusOverride);
  const sendInterest = useSendInterest();

  const [sheetPerson, setSheetPerson] = useState<ExploreResultItem | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const results = data?.pages.flatMap((p) => p.results) ?? [];
  const currentRadius = data?.pages[0]?.radiusKm ?? radiusOverride ?? profile?.radiusKm ?? 5;
  const nextRadius = RADIUS_OPTIONS.find((r) => r > currentRadius);

  // scroll infinito via IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const invite = async (person: ExploreResultItem, want: ExploreWantItem) => {
    setInvited((s) => new Set(s).add(person.userId)); // optimistic (FE-09)
    try {
      const res = await sendInterest.mutateAsync({ toUserId: person.userId, gameId: want.gameId });
      setSheetPerson(null);
      if (res.outcome === "matched" && res.matchId) {
        router.push(`/match/${res.matchId}`);
      } else {
        toast(`Convite enviado para ${person.displayName}!`, "success");
      }
    } catch (err) {
      setInvited((s) => {
        const n = new Set(s);
        n.delete(person.userId);
        return n;
      });
      toast(err instanceof Error ? err.message : "Erro ao enviar convite", "error");
    }
  };

  const onWantToPlay = (person: ExploreResultItem) => {
    if (person.wantsToPlay.length === 1) {
      void invite(person, person.wantsToPlay[0]);
    } else {
      trackEvent("sheet_jogo_aberto", { games: person.wantsToPlay.length });
      setSheetPerson(person);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/home")}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg leading-tight font-extrabold">Buscar jogadores</h1>
          <p className="text-xs text-muted">Quem quer jogar perto de você</p>
        </div>
      </header>

      <p className="rounded-input bg-cream-dark px-3.5 py-2.5 text-xs font-medium text-primary-dark">
        🔒 O contato só aparece depois do match.
      </p>

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2" aria-busy aria-live="polite">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : isError ? (
        <EmptyState icon="😕" title="Não foi possível buscar agora">
          <Button variant="outline" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </EmptyState>
      ) : results.length === 0 ? (
        <EmptyState
          icon="📍"
          title="Ninguém quer jogar por aqui ainda"
          description={`Buscamos num raio de ${currentRadius} km. Você pode ampliar a busca.`}
        >
          {nextRadius && (
            <Button full onClick={() => setRadiusOverride(nextRadius)}>
              Ampliar para {nextRadius} km
            </Button>
          )}
          <Link
            href="/home"
            className="text-center text-sm font-semibold text-primary-dark hover:underline"
          >
            Voltar para a home
          </Link>
        </EmptyState>
      ) : (
        <>
          <p className="text-sm text-muted" aria-live="polite">
            <strong className="text-ink">{results.length}</strong>{" "}
            {results.length === 1 ? "pessoa quer" : "pessoas querem"} jogar · por distância
          </p>
          <ul className="grid gap-3 md:grid-cols-2">
            {results.map((item) =>
              isGroup(item) ? (
                <li key={item.groupId}>
                  <GroupResultCard item={item} />
                </li>
              ) : (
                <li key={item.userId}>
                  <Card className="flex h-full items-start gap-3">
                    <Avatar name={item.displayName} photoUrl={item.photoUrl} size={52} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{item.displayName}</p>
                      <p className="text-xs text-muted">📍 {item.approxDistance}</p>
                      <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Quer jogar
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.wantsToPlay.slice(0, 4).map((w) => (
                          <TextChip key={w.gameId} highlight={w.inMyCollection}>
                            {w.name}
                          </TextChip>
                        ))}
                        {item.wantsToPlay.length > 4 && (
                          <TextChip>+{item.wantsToPlay.length - 4}</TextChip>
                        )}
                      </div>
                    </div>
                    {invited.has(item.userId) ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-input border border-line px-3 py-2 text-xs font-semibold text-muted">
                        🕐 Enviado
                      </span>
                    ) : (
                      <Button className="shrink-0 px-4" onClick={() => onWantToPlay(item)}>
                        Quero jogar
                      </Button>
                    )}
                  </Card>
                </li>
              ),
            )}
          </ul>

          {/* sentinela do scroll infinito */}
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {isFetchingNextPage && (
            <div className="grid gap-3 md:grid-cols-2" aria-busy>
              <CardSkeleton />
              <CardSkeleton />
            </div>
          )}
        </>
      )}

      <p className="text-center text-[11px] text-muted">
        Mostramos só a distância aproximada — nunca o endereço.
      </p>

      {/* FE-20 — sheet "Jogar o quê?" (v3-03) */}
      <BottomSheet
        open={sheetPerson !== null}
        onClose={() => setSheetPerson(null)}
        title={sheetPerson ? `Jogar o quê com ${sheetPerson.displayName}?` : ""}
      >
        <ul className="flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
          {sheetPerson?.wantsToPlay.map((w) => (
            <li key={w.gameId}>
              <button
                type="button"
                onClick={() => sheetPerson && invite(sheetPerson, w)}
                className={`flex w-full items-center justify-between rounded-input border p-3 text-left transition-colors hover:border-primary/50 ${
                  w.inMyCollection ? "border-primary bg-cream-dark" : "border-line bg-white"
                }`}
              >
                <span className="text-sm font-semibold">{w.name}</span>
                {w.inMyCollection ? (
                  <span className="text-[11px] font-semibold text-primary-dark">
                    você também tem
                  </span>
                ) : (
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </div>
  );
}
