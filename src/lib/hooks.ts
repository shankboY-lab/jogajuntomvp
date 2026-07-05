"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BggSearchItem,
  CollectionItem,
  ContactResponse,
  GameSummary,
  GeocodeResult,
  InboxResponse,
  MatchDetailResponse,
  ProfileResponse,
  SearchResponse,
} from "@/shared/types";
import type { ProfileInput } from "@/shared/schemas";

// FE-02 — hooks tipados ponta a ponta

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: () => api<ProfileResponse>("/api/profile"),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      api<{ profileComplete: boolean }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

export function useCollection() {
  return useQuery({
    queryKey: ["collection"],
    queryFn: () => api<{ items: CollectionItem[] }>("/api/collection"),
    select: (d) => d.items,
  });
}

export function useAddGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bggId: number) =>
      api<{ added: boolean; profileComplete: boolean }>("/api/collection", {
        method: "POST",
        body: JSON.stringify({ bggId }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
  });
}

export function useRemoveGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (bggId: number) =>
      api<{ removed: boolean }>(`/api/collection/${bggId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
  });
}

export function useBggSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["bgg-search", query],
    queryFn: () =>
      api<{ items: BggSearchItem[] }>(`/api/bgg/search?q=${encodeURIComponent(query)}`),
    select: (d) => d.items,
    enabled: enabled && query.trim().length >= 3,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  });
}

export function useBggThing(ids: number[]) {
  return useQuery({
    queryKey: ["bgg-thing", ids],
    queryFn: () => api<{ games: GameSummary[] }>(`/api/bgg/thing?ids=${ids.join(",")}`),
    select: (d) => d.games,
    enabled: ids.length > 0,
    staleTime: Infinity,
    retry: false,
  });
}

export function useSearchPlayers(params: { mode: "A" | "B"; bggId: number; radius?: number }) {
  const search = new URLSearchParams({ mode: params.mode, bggId: String(params.bggId) });
  if (params.radius) search.set("radius", String(params.radius));
  return useQuery({
    queryKey: ["search", params.mode, params.bggId, params.radius ?? null],
    queryFn: () => api<SearchResponse>(`/api/search?${search.toString()}`),
  });
}

// FE-11 — polling leve (30s + on focus), não há push na v1
export function useInbox() {
  return useQuery({
    queryKey: ["inbox"],
    queryFn: () => api<InboxResponse>("/api/inbox"),
    refetchInterval: 30_000,
  });
}

export function useSendInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { toUserId: string; bggId: number }) =>
      api<{ outcome: "pending" | "matched"; matchId?: string }>("/api/interests", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useRespondInterest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; action: "accept" | "decline" }) =>
      api<{ outcome: "declined" | "matched"; matchId?: string }>(`/api/interests/${input.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: input.action }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
}

export function useMatchDetail(matchId: string) {
  return useQuery({
    queryKey: ["match", matchId],
    queryFn: () => api<MatchDetailResponse>(`/api/matches/${matchId}`),
  });
}

export async function fetchContact(matchId: string, channel: "whatsapp" | "telegram") {
  return api<ContactResponse>(`/api/matches/${matchId}/contact?channel=${channel}`);
}

export async function geocodeForward(q: string) {
  return api<{ result: GeocodeResult | null }>(`/api/geocode?q=${encodeURIComponent(q)}`);
}

export async function geocodeReverse(lat: number, lng: number) {
  return api<{ result: GeocodeResult | null }>("/api/geocode/reverse", {
    method: "POST",
    body: JSON.stringify({ lat, lng }),
  });
}
