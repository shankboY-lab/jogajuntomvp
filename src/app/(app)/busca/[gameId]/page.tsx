"use client";

/* eslint-disable @next/next/no-img-element */

// FE-09 — resultados (v2-06, RF-17..19/22): ordenados por distância, botão por
// interestState com optimistic update, banner de privacidade fixo.
// FE-10 — estado vazio (v2-09, RF-20): ampliar raio (persiste só se confirmar).

import { use, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { TextChip } from "@/components/ui/Chip";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { GroupResultCard } from "@/components/GroupResultCard";
import { useSearchPlayers, useSendInterest, useProfile, useSaveProfile } from "@/lib/hooks";
import { usePageView } from "@/lib/track";
import { isFeatureEnabled } from "@/shared/flags";
import { RADIUS_OPTIONS, type RadiusKm } from "@/shared/schemas";
import type { GroupResultItem, SearchResultEntry, SearchResultItem } from "@/shared/types";

function isGroup(item: SearchResultEntry): item is GroupResultItem {
  return "type" in item && item.type === "group";
}

function countLabel(results: SearchResultEntry[]): string {
  const groups = results.filter(isGroup).length;
  const people = results.length - groups;
  const parts = [`${people} ${people === 1 ? "pessoa" : "pessoas"}`];
  if (groups > 0) parts.push(`${groups} ${groups === 1 ? "grupo" : "grupos"}`);
  return parts.join(" e ");
}

export default function SearchResultsPage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = use(params);
  const searchParams = useSearchParams();
  const mode = (searchParams.get("mode") === "B" ? "B" : "A") as "A" | "B";
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  usePageView("busca_resultados");

  const [radiusOverride, setRadiusOverride] = useState<number | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useSearchPlayers({
    mode,
    gameId,
    radius: radiusOverride,
  });
  const { data: profile } = useProfile();
  const sendInterest = useSendInterest();
  const saveNewRadius = useSaveProfile();

  const currentRadius = data?.radiusKm ?? radiusOverride ?? profile?.radiusKm ?? 5;
  const nextRadius = RADIUS_OPTIONS.find((r) => r > currentRadius);

  const onInterest = async (item: SearchResultItem) => {
    try {
      const result = await sendInterest.mutateAsync({ toUserId: item.userId, gameId });
      if (result.outcome === "matched" && result.matchId) {
        router.push(`/match/${result.matchId}`);
      } else {
        toast("Convite enviado! Avisamos quando responder.", "success");
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao enviar convite", "error");
    }
  };

  const expandRadius = () => {
    if (!nextRadius) return;
    setRadiusOverride(nextRadius);
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
        {data?.game.thumbnailUrl && (
          <img
            src={data.game.thumbnailUrl}
            alt=""
            width={44}
            height={44}
            className="size-11 rounded-md object-cover"
          />
        )}
        <div>
          <h1 className="text-lg leading-tight font-extrabold">{data?.game.name ?? "…"}</h1>
          <p className="text-xs text-muted">Quem quer jogar perto de você</p>
        </div>
      </header>

      {/* banner de privacidade (v2-06) */}
      <p className="rounded-input bg-cream-dark px-3.5 py-2.5 text-xs font-medium text-primary-dark">
        🔒 O contato só aparece depois do match.
      </p>

      {/* FE-21 — criar grupo para este jogo (modo A, atrás de FEATURE_GROUPS) */}
      {mode === "A" && isFeatureEnabled("groups") && (
        <Link
          href={`/grupos/criar?gameId=${gameId}`}
          className="flex items-center justify-center gap-2 rounded-input border border-primary bg-white px-3.5 py-2.5 text-sm font-bold text-primary-dark hover:bg-cream-dark"
        >
          👥 Criar grupo para este jogo
        </Link>
      )}

      {isLoading || isRefetching ? (
        <div className="flex flex-col gap-3" aria-busy aria-live="polite">
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
      ) : data && data.results.length === 0 ? (
        // FE-10 — v2-09
        <EmptyState
          icon="📍"
          title={`Ninguém quer jogar ${data.game.name} por aqui ainda`}
          description={`Buscamos num raio de ${currentRadius} km. Você pode ampliar a busca ou tentar outro jogo.`}
        >
          {nextRadius && (
            <Button full onClick={expandRadius}>
              Ampliar para {nextRadius} km
            </Button>
          )}
          {radiusOverride && radiusOverride !== profile?.radiusKm && profile && (
            <Button
              full
              variant="ghost"
              onClick={async () => {
                // persiste o novo raio SÓ com confirmação explícita (FE-10)
                await saveNewRadius.mutateAsync({
                  displayName: profile.displayName,
                  photoUrl: profile.photoUrl,
                  city: profile.city,
                  neighborhood: profile.neighborhood,
                  lat: null,
                  lng: null,
                  radiusKm: radiusOverride as RadiusKm,
                  whatsapp: profile.whatsapp,
                  telegram: profile.telegram,
                  locationConsent: true,
                });
                qc.invalidateQueries({ queryKey: ["profile"] });
                toast(`Raio padrão atualizado para ${radiusOverride} km`, "success");
              }}
            >
              Manter {radiusOverride} km como padrão
            </Button>
          )}
          <Link
            href="/home"
            className="text-center text-sm font-semibold text-primary-dark hover:underline"
          >
            Buscar outro jogo
          </Link>
        </EmptyState>
      ) : (
        data && (
          <>
            <p className="text-sm text-muted" aria-live="polite">
              {countLabel(data.results)} · por distância · {currentRadius} km
            </p>
            <ul className="flex flex-col gap-3">
              {data.results.map((item) =>
                isGroup(item) ? (
                  <li key={item.groupId}>
                    <GroupResultCard item={item} />
                  </li>
                ) : (
                  <li key={item.userId}>
                    <Card className="flex items-center gap-3">
                      <Avatar name={item.displayName} photoUrl={item.photoUrl} size={52} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{item.displayName}</p>
                        <p className="text-xs text-muted">📍 {item.approxDistance}</p>
                        {item.commonGames.length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {item.commonGames.map((name) => (
                              <TextChip key={name}>{name}</TextChip>
                            ))}
                            {item.commonGamesCount > item.commonGames.length && (
                              <TextChip>
                                +{item.commonGamesCount - item.commonGames.length}
                              </TextChip>
                            )}
                          </div>
                        )}
                      </div>
                      <InterestButton item={item} onInterest={onInterest} />
                    </Card>
                  </li>
                ),
              )}
            </ul>
          </>
        )
      )}

      <p className="text-center text-[11px] text-muted">
        Mostramos só a distância aproximada — nunca o endereço.
      </p>
    </div>
  );
}

function InterestButton({
  item,
  onInterest,
}: {
  item: SearchResultItem;
  onInterest: (item: SearchResultItem) => Promise<void>;
}) {
  const [pendingLocal, setPendingLocal] = useState(false);
  const [sentLocal, setSentLocal] = useState(false);

  if (item.interestState === "matched" && item.matchId) {
    return (
      <Link
        href={`/match/${item.matchId}`}
        className="rounded-input bg-cream-dark px-3 py-2 text-xs font-bold text-primary-dark"
      >
        🎉 Match!
      </Link>
    );
  }
  if (item.interestState === "received") {
    return (
      <Link
        href="/convites"
        className="rounded-input bg-cream-dark px-3 py-2 text-center text-xs font-bold text-primary-dark"
      >
        Te convidou →
      </Link>
    );
  }
  if (item.interestState === "sent" || sentLocal) {
    return (
      <span className="inline-flex items-center gap-1 rounded-input border border-line px-3 py-2 text-xs font-semibold text-muted">
        🕐 Convite enviado
      </span>
    );
  }
  return (
    <Button
      loading={pendingLocal}
      onClick={async () => {
        setPendingLocal(true);
        setSentLocal(true); // optimistic (FE-09)
        try {
          await onInterest(item);
        } catch {
          setSentLocal(false);
        } finally {
          setPendingLocal(false);
        }
      }}
      className="shrink-0 px-4"
    >
      Quero jogar
    </Button>
  );
}
