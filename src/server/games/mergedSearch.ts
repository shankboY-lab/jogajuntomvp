import { bggSearch, BggUnavailableError, normalizeQuery } from "@/server/bgg/client";
import { isBggDown } from "@/server/bgg/breaker";
import { searchReserve } from "@/server/games/reserve";
import { isFeatureEnabled } from "@/shared/flags";
import type { GameSearchItem, GameSearchResponse, GameSummary } from "@/shared/types";

// BE-19 — busca de catálogo mesclada (RF-29/30/31).
//   breaker fechado → resultado BGG (fluxo v2) + merge de USER_CREATED do reserva.
//   breaker aberto  → só reserva completo (cache BGG + user_created), bggDown: true.
//   canCreateManual → só com breaker aberto E zero resultados E flag manual on (RF-31).

const MIN_LEN = 3;

function toItem(g: GameSummary): GameSearchItem {
  return {
    gameId: g.gameId,
    bggId: g.bggId,
    name: g.name,
    yearPublished: g.yearPublished,
    thumbnailUrl: g.thumbnailUrl,
    source: g.source,
  };
}

export async function searchCatalog(rawQuery: string): Promise<GameSearchResponse> {
  const term = normalizeQuery(rawQuery);
  if (term.length < MIN_LEN) {
    return { items: [], bggDown: false, canCreateManual: false };
  }

  const manualEnabled = isFeatureEnabled("manualGames");
  let bggDown = await isBggDown();

  if (!bggDown) {
    let bggItems: GameSearchItem[] = [];
    try {
      const raw = await bggSearch(term);
      bggItems = raw.map((i) => ({
        gameId: null,
        bggId: i.bggId,
        name: i.name,
        yearPublished: i.yearPublished,
        thumbnailUrl: null,
        source: "BGG" as const,
      }));
    } catch (err) {
      if (!(err instanceof BggUnavailableError)) throw err;
    }
    // o breaker pode ter aberto durante a chamada (falha registrada em bggFetch)
    bggDown = await isBggDown();
    if (!bggDown) {
      const userCreated = await searchReserve(term, { source: "USER_CREATED" });
      return {
        items: [...bggItems, ...userCreated.map(toItem)],
        bggDown: false,
        canCreateManual: false,
      };
    }
  }

  // breaker aberto → só o banco reserva (cache BGG + user_created)
  const reserve = await searchReserve(term, { limit: 20 });
  const items = reserve.map(toItem);
  return {
    items,
    bggDown: true,
    canCreateManual: manualEnabled && items.length === 0,
  };
}
