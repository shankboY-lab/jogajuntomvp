import { describe, expect, it } from "vitest";
import { haversineKm, formatApproxDistance, boundingBox, roundCoord } from "@/server/geo/distance";

// QA-01 — haversine + formatação de distância (limites 999 m / 1,0 km)

describe("haversineKm", () => {
  it("distância zero para o mesmo ponto", () => {
    expect(haversineKm(-23.562, -46.702, -23.562, -46.702)).toBe(0);
  });

  it("Pinheiros → Sé (~7,5 km) dentro da tolerância", () => {
    const km = haversineKm(-23.562, -46.702, -23.5505, -46.6333);
    expect(km).toBeGreaterThan(6.5);
    expect(km).toBeLessThan(8.5);
  });

  it("1 grau de latitude ≈ 111 km", () => {
    const km = haversineKm(0, 0, 1, 0);
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });
});

describe("formatApproxDistance (RNF-07)", () => {
  it("< 1 km arredonda para 100 m", () => {
    expect(formatApproxDistance(0.649)).toBe("a ~600 m");
    expect(formatApproxDistance(0.55)).toBe("a ~600 m");
    expect(formatApproxDistance(0.512)).toBe("a ~500 m");
  });

  it("distâncias mínimas clampam em 100 m (nunca revela 'colado')", () => {
    expect(formatApproxDistance(0)).toBe("a ~100 m");
    expect(formatApproxDistance(0.04)).toBe("a ~100 m");
  });

  it("limite 999 m → 1,0 km", () => {
    expect(formatApproxDistance(0.94)).toBe("a ~900 m");
    expect(formatApproxDistance(0.96)).toBe("a ~1,0 km");
    expect(formatApproxDistance(0.999)).toBe("a ~1,0 km");
  });

  it(">= 1 km usa 1 casa decimal com vírgula", () => {
    expect(formatApproxDistance(1.0)).toBe("a ~1,0 km");
    expect(formatApproxDistance(1.23)).toBe("a ~1,2 km");
    expect(formatApproxDistance(4.9)).toBe("a ~4,9 km");
    expect(formatApproxDistance(12.34)).toBe("a ~12,3 km");
  });
});

describe("boundingBox (pré-filtro DB-03)", () => {
  it("box contém o círculo do raio", () => {
    const box = boundingBox(-23.562, -46.702, 5);
    // ponto a ~4,9 km ao norte deve estar dentro do box
    const north = -23.562 + 4.9 / 110.574;
    expect(north).toBeGreaterThan(box.latMin);
    expect(north).toBeLessThan(box.latMax);
  });
});

describe("roundCoord (privacidade BE-07)", () => {
  it("trunca a 3 casas (~110 m)", () => {
    expect(roundCoord(-23.5618234)).toBe(-23.562);
    expect(roundCoord(-46.70199)).toBe(-46.702);
  });
});
