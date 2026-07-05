import { describe, expect, it } from "vitest";
import { parseBggSearch, parseBggThing } from "@/server/bgg/parse";

// QA-01 — parser XML BGG (fixtures no formato real da XML API2)

const SEARCH_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="3" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <name type="primary" value="CATAN"/>
    <yearpublished value="1995"/>
  </item>
  <item type="boardgame" id="278791">
    <name type="alternate" value="Catan: Big Box"/>
    <yearpublished value="2018"/>
  </item>
  <item type="boardgame" id="27710">
    <name type="primary" value="Catan Dice Game"/>
  </item>
</items>`;

const SEARCH_SINGLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="1" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="266192">
    <name type="primary" value="Wingspan"/>
    <yearpublished value="2019"/>
  </item>
</items>`;

const SEARCH_EMPTY_XML = `<?xml version="1.0" encoding="utf-8"?>
<items total="0" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse"/>`;

const THING_XML = `<?xml version="1.0" encoding="utf-8"?>
<items termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item type="boardgame" id="13">
    <thumbnail>https://cf.geekdo-images.com/thumb/catan.jpg</thumbnail>
    <image>https://cf.geekdo-images.com/original/catan.jpg</image>
    <name type="primary" sortindex="1" value="CATAN"/>
    <name type="alternate" sortindex="1" value="Catan (Колонизаторы)"/>
    <yearpublished value="1995"/>
  </item>
  <item type="boardgame" id="266192">
    <thumbnail>https://cf.geekdo-images.com/thumb/wingspan.jpg</thumbnail>
    <name type="primary" sortindex="1" value="Wingspan"/>
    <yearpublished value="2019"/>
  </item>
</items>`;

describe("parseBggSearch", () => {
  it("extrai id, nome e ano", () => {
    const items = parseBggSearch(SEARCH_XML);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ bggId: 13, name: "CATAN", yearPublished: 1995 });
  });

  it("item sem ano → yearPublished null", () => {
    const items = parseBggSearch(SEARCH_XML);
    expect(items[2]).toEqual({ bggId: 27710, name: "Catan Dice Game", yearPublished: null });
  });

  it("um único item (objeto, não array) é normalizado", () => {
    const items = parseBggSearch(SEARCH_SINGLE_XML);
    expect(items).toHaveLength(1);
    expect(items[0].bggId).toBe(266192);
  });

  it("resultado vazio → lista vazia", () => {
    expect(parseBggSearch(SEARCH_EMPTY_XML)).toEqual([]);
  });
});

describe("parseBggThing", () => {
  it("usa o nome primary quando há alternates e extrai a capa", () => {
    const games = parseBggThing(THING_XML);
    expect(games).toHaveLength(2);
    expect(games[0]).toEqual({
      bggId: 13,
      name: "CATAN",
      yearPublished: 1995,
      thumbnailUrl: "https://cf.geekdo-images.com/thumb/catan.jpg",
    });
  });
});
