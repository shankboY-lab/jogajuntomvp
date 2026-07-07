// Tipos de resposta da API compartilhados com o cliente (FE-02).

export type InterestState = "none" | "sent" | "received" | "matched";

export type GameSource = "BGG" | "USER_CREATED";

/** Jogo materializado no catálogo — `gameId` interno é a chave canônica (v3/RF-34). */
export interface GameSummary {
  gameId: string;
  bggId: number | null;
  name: string;
  yearPublished: number | null;
  thumbnailUrl: string | null;
  source: GameSource;
}

/** Resultado cru da busca BGG (search), antes de materializar em `games`. */
export interface BggSearchItem {
  bggId: number;
  name: string;
  yearPublished: number | null;
}

/** Detalhe cru da BGG (thing), antes de materializar em `games`. */
export interface BggThing {
  bggId: number;
  name: string;
  yearPublished: number | null;
  thumbnailUrl: string | null;
}

/** BE-19 — item da busca de catálogo mesclada (BGG + reserva). */
export interface GameSearchItem {
  /** null p/ resultado BGG ainda não materializado (o thing cria o Game). */
  gameId: string | null;
  bggId: number | null;
  name: string;
  yearPublished: number | null;
  thumbnailUrl: string | null;
  source: GameSource;
}

/** BE-19 — resposta da busca mesclada; a UI não decide sozinha o CTA manual. */
export interface GameSearchResponse {
  items: GameSearchItem[];
  /** BGG indisponível (breaker aberto ou falha na chamada). */
  bggDown: boolean;
  /** RF-31 — só true com breaker aberto E zero resultados no reserva E flag on. */
  canCreateManual: boolean;
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

/** Resultado de busca A/B: pessoa (sem `type`) OU grupo (`type:"group"`). */
export type SearchResultEntry = SearchResultItem | GroupResultItem;

export interface SearchResponse {
  game: GameSummary;
  radiusKm: number;
  total: number;
  results: SearchResultEntry[];
}

/** BE-22 — modo C "explorar": jogo que a pessoa quer jogar + interseção. */
export interface ExploreWantItem {
  gameId: string;
  name: string;
  inMyCollection: boolean;
}

export interface ExploreResultItem {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  /** RNF-07 — formatada no servidor; nunca coordenadas. */
  approxDistance: string;
  wantsToPlay: ExploreWantItem[];
}

/** Resultado do modo C: pessoa (sem `type`) OU grupo (`type:"group"`). */
export type ExploreEntry = ExploreResultItem | GroupResultItem;

export interface ExploreResponse {
  results: ExploreEntry[];
  page: number;
  hasMore: boolean;
  radiusKm: number;
}

// v3/F3 — grupos (RF-41..53)
export type GroupStatus = "OPEN" | "FULL" | "CANCELLED" | "EXPIRED";
export type GroupRequestState = "none" | "pending" | "accepted" | "declined" | "member";

/** Item tipo grupo nos resultados de busca (A/B/C) — sem coords/contato. */
export interface GroupResultItem {
  type: "group";
  groupId: string;
  name: string;
  game: { gameId: string; name: string; thumbnailUrl: string | null };
  creator: { displayName: string; photoUrl: string | null };
  slotsTotal: number;
  slotsFilled: number;
  approxDistance: string; // do criador (RNF-15)
  myRequestState: GroupRequestState;
}

export interface GroupMemberView {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  matchId: string;
}

export interface GroupRequestView {
  requestId: string;
  user: { userId: string; displayName: string; photoUrl: string | null };
  createdAt: string;
}

export interface GroupDetailResponse {
  groupId: string;
  name: string;
  game: GameSummary;
  creator: { userId: string; displayName: string; photoUrl: string | null };
  slotsTotal: number;
  slotsFilled: number;
  status: GroupStatus;
  expiresAt: string;
  approxDistance: string; // do criador (RNF-15)
  isCreator: boolean;
  myRequestState: GroupRequestState;
  /** match com o criador, se sou membro (libera o contato). */
  myMatchId: string | null;
  /** só na visão do criador: */
  requests?: GroupRequestView[];
  members?: GroupMemberView[];
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

// BE-27 — seções novas da inbox (RF-53). Shape v2 (3 tabs) mantido; aditivo.
export interface InboxGroupRequestReceived {
  requestId: string;
  groupId: string;
  groupName: string;
  game: GameSummary;
  user: { userId: string; displayName: string; photoUrl: string | null };
  slotsTotal: number;
  slotsFilled: number;
  createdAt: string;
}

export interface InboxGroupRequestSent {
  requestId: string;
  groupId: string;
  groupName: string;
  game: GameSummary;
  state: GroupRequestState;
  createdAt: string;
}

export interface InboxNotification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface InboxResponse {
  received: InboxRequestItem[];
  sent: InboxRequestItem[];
  matches: InboxMatchItem[];
  groupRequests: { received: InboxGroupRequestReceived[]; sent: InboxGroupRequestSent[] };
  notifications: InboxNotification[];
  counts: {
    received: number;
    matches: number;
    groupRequests: number;
    notifications: number;
    /** badge da nav = interesses recebidos + pedidos de grupo + notificações. */
    badge: number;
  };
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
