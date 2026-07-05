import { describe, expect, it } from "vitest";
import { isProfileCompleteRule } from "@/shared/profileRule";

// QA-01 — regra profileComplete (BE-06, dirige o roteamento RF-04)

const base = {
  displayName: "Rodrigo",
  city: "São Paulo",
  hasCoords: true,
  hasConsent: true,
  whatsapp: "+5511999990000",
  telegram: null,
  gamesCount: 1,
};

describe("isProfileCompleteRule", () => {
  it("completo com o mínimo (nome+cidade+coords+consent+1 contato+1 jogo)", () => {
    expect(isProfileCompleteRule(base)).toBe(true);
  });

  it("telegram sozinho satisfaz o requisito de contato", () => {
    expect(isProfileCompleteRule({ ...base, whatsapp: null, telegram: "rodrigo_jj" })).toBe(true);
  });

  it("sem nenhum contato → incompleto (§8 Gaps)", () => {
    expect(isProfileCompleteRule({ ...base, whatsapp: null, telegram: null })).toBe(false);
  });

  it("sem consentimento → incompleto (RF-27)", () => {
    expect(isProfileCompleteRule({ ...base, hasConsent: false })).toBe(false);
  });

  it("sem jogos → incompleto", () => {
    expect(isProfileCompleteRule({ ...base, gamesCount: 0 })).toBe(false);
  });

  it("nome com menos de 2 chars → incompleto", () => {
    expect(isProfileCompleteRule({ ...base, displayName: " R " })).toBe(false);
  });

  it("sem coordenadas → incompleto", () => {
    expect(isProfileCompleteRule({ ...base, hasCoords: false })).toBe(false);
  });
});
