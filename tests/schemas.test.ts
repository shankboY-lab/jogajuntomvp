import { describe, expect, it } from "vitest";
import {
  normalizeWhatsapp,
  normalizeTelegram,
  profileSchema,
  eventsIngestSchema,
  searchQuerySchema,
  sanitizeName,
  manualGameSchema,
  groupCreateSchema,
} from "@/shared/schemas";

// QA-01 — validações compartilhadas UI/API

describe("normalizeWhatsapp", () => {
  it("aceita formato BR com máscara e prefixa DDI 55", () => {
    expect(normalizeWhatsapp("(11) 99999-0000")).toBe("+5511999990000");
  });
  it("mantém E.164 já com DDI", () => {
    expect(normalizeWhatsapp("+5511999990000")).toBe("+5511999990000");
  });
  it("rejeita números curtos demais", () => {
    expect(normalizeWhatsapp("1234")).toBeNull();
  });
});

describe("normalizeTelegram", () => {
  it("remove @ e valida username", () => {
    expect(normalizeTelegram("@rodrigo_jj")).toBe("rodrigo_jj");
  });
  it("rejeita usernames com menos de 5 chars", () => {
    expect(normalizeTelegram("@abc")).toBeNull();
  });
});

describe("profileSchema", () => {
  const valid = {
    displayName: "Rodrigo",
    city: "São Paulo",
    neighborhood: "Pinheiros",
    lat: -23.562,
    lng: -46.702,
    radiusKm: 5,
    whatsapp: "(11) 99999-0000",
    telegram: null,
    locationConsent: true,
  };

  it("perfil válido passa", () => {
    expect(profileSchema.safeParse(valid).success).toBe(true);
  });

  it("sem consent → 422 (RF-27)", () => {
    expect(profileSchema.safeParse({ ...valid, locationConsent: false }).success).toBe(false);
  });

  it("sem nenhum contato → falha (§8 Gaps)", () => {
    expect(profileSchema.safeParse({ ...valid, whatsapp: null, telegram: null }).success).toBe(
      false,
    );
  });

  it("raio fora de {2,5,10,25,50} → falha (RF-09)", () => {
    expect(profileSchema.safeParse({ ...valid, radiusKm: 7 }).success).toBe(false);
    expect(profileSchema.safeParse({ ...valid, radiusKm: 100 }).success).toBe(false);
  });

  it("raio máximo de 50 km é aceito", () => {
    expect(profileSchema.safeParse({ ...valid, radiusKm: 50 }).success).toBe(true);
  });

  it("lat/lng nulos (modo edição) passam juntos, mas não separados", () => {
    expect(profileSchema.safeParse({ ...valid, lat: null, lng: null }).success).toBe(true);
    expect(profileSchema.safeParse({ ...valid, lat: null }).success).toBe(false);
  });
});

describe("eventsIngestSchema (BE-16)", () => {
  it("aceita eventos do enum", () => {
    const res = eventsIngestSchema.safeParse({
      events: [{ name: "page_view", props: { page: "home" } }],
    });
    expect(res.success).toBe(true);
  });

  it("rejeita nome fora do enum", () => {
    const res = eventsIngestSchema.safeParse({ events: [{ name: "hack_attempt", props: {} }] });
    expect(res.success).toBe(false);
  });

  it("rejeita batch acima de 20", () => {
    const events = Array.from({ length: 21 }, () => ({ name: "page_view" as const, props: {} }));
    expect(eventsIngestSchema.safeParse({ events }).success).toBe(false);
  });
});

describe("searchQuerySchema (BE-12)", () => {
  // v3/DB-07 — o parâmetro passou de bggId (int) para gameId (id interno ou
  // bggId numérico legado, ambos string). Rename coberto pelo redirect de /busca.
  it("aceita modos A e B com radius opcional do conjunto", () => {
    expect(searchQuerySchema.safeParse({ mode: "A", gameId: "13" }).success).toBe(true);
    expect(
      searchQuerySchema.safeParse({ mode: "B", gameId: "clx0abc123", radius: "10" }).success,
    ).toBe(true);
    expect(searchQuerySchema.safeParse({ mode: "A", gameId: "13", radius: 50 }).success).toBe(true);
  });
  it("rejeita raio fora do conjunto", () => {
    expect(searchQuerySchema.safeParse({ mode: "A", gameId: "13", radius: 7 }).success).toBe(false);
  });
});

describe("sanitizeName (INF-09)", () => {
  it("colapsa espaços e remove controle/zero-width", () => {
    expect(sanitizeName("  Catan​   Deluxe  ")).toBe("Catan Deluxe");
  });
  it("mantém < > como texto (armazenado, nunca renderizado como HTML)", () => {
    expect(sanitizeName("<b>Jogo</b>")).toBe("<b>Jogo</b>");
  });
});

describe("manualGameSchema (BE-20)", () => {
  it("aceita jogo válido e sanitiza o nome", () => {
    const r = manualGameSchema.safeParse({ name: "  Meu   Jogo  ", yearPublished: 2020 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe("Meu Jogo");
  });
  it("rejeita min > max jogadores", () => {
    expect(
      manualGameSchema.safeParse({ name: "Jogo Teste", minPlayers: 5, maxPlayers: 2 }).success,
    ).toBe(false);
  });
  it("rejeita nome com menos de 3 chars", () => {
    expect(manualGameSchema.safeParse({ name: "ab" }).success).toBe(false);
  });
});

describe("groupCreateSchema (BE-24)", () => {
  it("aceita grupo válido (slots 1–9)", () => {
    expect(
      groupCreateSchema.safeParse({ gameId: "abc", name: "Mesa de sexta", slots: 3 }).success,
    ).toBe(true);
  });
  it("rejeita slots fora de 1–9", () => {
    expect(groupCreateSchema.safeParse({ gameId: "abc", name: "Mesa", slots: 12 }).success).toBe(
      false,
    );
    expect(groupCreateSchema.safeParse({ gameId: "abc", name: "Mesa", slots: 0 }).success).toBe(
      false,
    );
  });
});
