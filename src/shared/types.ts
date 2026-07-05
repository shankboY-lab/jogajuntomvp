// Tipos de resposta da API compartilhados com o cliente (FE-02).

export type InterestState = "none" | "sent" | "received" | "matched";

export interface GameSummary {
  bggId: number;
  name: string;
  yearPublished: number | null;
  thumbnailUrl: string | null;
}

export interface BggSearchItem {
  bggId: number;
  name: string;
  yearPublished: number | null;
}

export interface SearchResultItem {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  /** RNF-07 — já formatada no servidor ("a ~600 m" / "a ~1,2 km"). Nunca coordenadas. */
  approxDistance: string;
  commonGames: string[];
  commonGamesCount: number;
  interestState: InterestState;
  matchId: string | null;
}

export interface SearchResponse {
  game: GameSummary;
  radiusKm: number;
  total: number;
  results: SearchResultItem[];
}

export interface ProfileResponse {
  displayName: string;
  photoUrl: string | null;
  city: string;
  neighborhood: string | null;
  radiusKm: number;
  whatsapp: string | null;
  telegram: string | null;
  hasLocation: boolean;
  profileComplete: boolean;
  email: string;
  hasPassword: boolean;
}

export interface CollectionItem extends GameSummary {
  intentActive: boolean;
}

export interface InboxRequestItem {
  id: string;
  user: { userId: string; displayName: string; photoUrl: string | null };
  game: GameSummary;
  approxDistance: string;
  createdAt: string;
}

export interface InboxMatchItem {
  matchId: string;
  user: { userId: string; displayName: string; photoUrl: string | null };
  game: GameSummary;
  approxDistance: string;
  createdAt: string;
}

export interface InboxResponse {
  received: InboxRequestItem[];
  sent: InboxRequestItem[];
  matches: InboxMatchItem[];
  counts: { received: number; matches: number };
}

export interface MatchDetailResponse {
  matchId: string;
  partner: { displayName: string; photoUrl: string | null };
  me: { displayName: string; photoUrl: string | null };
  game: GameSummary;
  approxDistance: string;
  channels: { whatsapp: boolean; telegram: boolean };
}

export interface ContactResponse {
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export interface GeocodeResult {
  city: string;
  neighborhood: string | null;
  lat: number;
  lng: number;
  label: string;
}
