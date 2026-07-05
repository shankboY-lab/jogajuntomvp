import { describe, expect, it } from "vitest";
import {
  normalizeWhatsapp,
  normalizeTelegram,
  profileSchema,
  eventsIngestSchema,
  searchQuerySchema,
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

  it("raio fora de {2,5,10,25} → falha (RF-09)", () => {
    expect(profileSchema.safeParse({ ...valid, radiusKm: 7 }).success).toBe(false);
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
  it("aceita modos A e B com radius opcional do conjunto", () => {
    expect(searchQuerySchema.safeParse({ mode: "A", bggId: "13" }).success).toBe(true);
    expect(searchQuerySchema.safeParse({ mode: "B", bggId: 13, radius: "10" }).success).toBe(true);
  });
  it("rejeita raio fora do conjunto", () => {
    expect(searchQuerySchema.safeParse({ mode: "A", bggId: 13, radius: 7 }).success).toBe(false);
  });
});
