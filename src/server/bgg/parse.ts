import { XMLParser } from "fast-xml-parser";
import type { BggSearchItem, GameSummary } from "@/shared/types";

// BE-08/BE-09 — parse do XML da BGG XML API2 (fixtures reais em tests/fixtures).

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

interface RawName {
  "@_type"?: string;
  "@_value"?: string;
}

function primaryName(name: RawName | RawName[] | undefined): string | null {
  const names = asArray(name);
  const primary = names.find((n) => n["@_type"] === "primary") ?? names[0];
  return primary?.["@_value"] ?? null;
}

/** search?query=...&type=boardgame → itens (máx 20) */
export function parseBggSearch(xml: string): BggSearchItem[] {
  const doc = parser.parse(xml);
  const items = asArray(doc?.items?.item);
  const results: BggSearchItem[] = [];
  for (const item of items) {
    const bggId = Number(item["@_id"]);
    const name = primaryName(item.name);
    if (!Number.isFinite(bggId) || !name) continue;
    const year = item.yearpublished?.["@_value"];
    results.push({
      bggId,
      name,
      yearPublished: year ? Number(year) : null,
    });
  }
  // dedupe por bggId (BGG pode repetir com nomes alternativos)
  const seen = new Set<number>();
  return results
    .filter((r) => (seen.has(r.bggId) ? false : (seen.add(r.bggId), true)))
    .slice(0, 20);
}

/** thing?id=1,2,... → detalhes p/ desambiguação (v2-04): nome, ano, capa */
export function parseBggThing(xml: string): GameSummary[] {
  const doc = parser.parse(xml);
  const items = asArray(doc?.items?.item);
  const results: GameSummary[] = [];
  for (const item of items) {
    const bggId = Number(item["@_id"]);
    const name = primaryName(item.name);
    if (!Number.isFinite(bggId) || !name) continue;
    const year = item.yearpublished?.["@_value"];
    const thumbnail = typeof item.thumbnail === "string" ? item.thumbnail : null;
    results.push({
      bggId,
      name,
      yearPublished: year ? Number(year) : null,
      thumbnailUrl: thumbnail || null,
    });
  }
  return results;
}
