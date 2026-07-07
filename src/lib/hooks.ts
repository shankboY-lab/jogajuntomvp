"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BggSearchItem,
  CollectionItem,
  ContactResponse,
  ExploreResponse,
  GameSearchResponse,
  GameSummary,
  GeocodeResult,
  GroupDetailResponse,
  InboxResponse,
  MatchDetailResponse,
  ProfileResponse,
  SearchResponse,
} from "@/shared/types";
import type { GroupCreateInput, ManualGameInput, ProfileInput } from "@/shared/schemas";

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
    // aceita ref BGG (bggId) ou id interno (jogos USER_CREATED / já materializados)
    mutationFn: (ref: { bggId: number } | { gameId: string }) =>
      api<{ added: boolean; profileComplete: boolean }>("/api/collection", {
        method: "POST",
        body: JSON.stringify(ref),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
  });
}

export function useRemoveGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (gameId: string) =>
      api<{ removed: boolean }>(`/api/collection/${gameId}`, { method: "DELETE" }),
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

// BE-19/FE-16 — busca de catálogo mesclada (BGG + reserva) com bggDown/canCreateManual.
export function useGameSearch(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ["game-search", query],
    queryFn: () => api<GameSearchResponse>(`/api/games/search?q=${encodeURIComponent(query)}`),
    enabled: enabled && query.trim().length >= 3,
    staleTime: 60 * 1000,
    retry: false,
  });
}

// BE-20/FE-17 — cadastro manual de jogo. 409 (dedup) vem como ApiClientError.
export function useCreateManualGame() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualGameInput) =>
      api<{ game: GameSummary; profileComplete: boolean }>("/api/games", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collection"] }),
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

export function useSearchPlayers(params: { mode: "A" | "B"; gameId: string; radius?: number }) {
  const search = new URLSearchParams({ mode: params.mode, gameId: params.gameId });
  if (params.radius) search.set("radius", String(params.radius));
  return useQuery({
    queryKey: ["search", params.mode, params.gameId, params.radius ?? null],
    queryFn: () => api<SearchResponse>(`/api/search?${search.toString()}`),
  });
}

// BE-22/FE-19 — busca modo C "explorar" com scroll infinito (páginas de 20).
export function useExplore(radius?: number) {
  return useInfiniteQuery({
    queryKey: ["explore", radius ?? null],
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ mode: "C", page: String(pageParam) });
      if (radius) p.set("radius", String(radius));
      return api<ExploreResponse>(`/api/search?${p.toString()}`);
    },
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
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
    mutationFn: (input: { toUserId: string; gameId: string }) =>
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

// ===== v3/F3 — grupos =====

export function useCreateGroup() {
  return useMutation({
    mutationFn: (input: GroupCreateInput) =>
      api<{ groupId: string }>("/api/groups", { method: "POST", body: JSON.stringify(input) }),
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: ["group", groupId],
    queryFn: () => api<GroupDetailResponse>(`/api/groups/${groupId}`),
    refetchInterval: 30_000, // padrão inbox v2 (polling)
  });
}

export function useRequestJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) =>
      api<{ requested: boolean }>(`/api/groups/${groupId}/requests`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["search"] });
      qc.invalidateQueries({ queryKey: ["explore"] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useRespondGroupRequest(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reqId: string; action: "accept" | "decline" }) =>
      api<{ outcome: string; matchId?: string; becameFull?: boolean }>(
        `/api/groups/${groupId}/requests/${input.reqId}`,
        { method: "PATCH", body: JSON.stringify({ action: input.action }) },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group", groupId] });
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });
}

export function useCancelGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => api(`/api/groups/${groupId}`, { method: "DELETE" }),
    onSuccess: (_d, groupId) => qc.invalidateQueries({ queryKey: ["group", groupId] }),
  });
}

export function useLeaveOrRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { groupId: string; userId: string }) =>
      api(`/api/groups/${input.groupId}/members/${input.userId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["group", v.groupId] }),
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });
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
