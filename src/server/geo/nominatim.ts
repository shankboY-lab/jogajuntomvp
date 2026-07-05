import { prisma } from "@/server/db";
import { ApiError } from "@/server/http";
import { waitForToken } from "@/server/rateLimit";
import { roundCoord } from "@/server/geo/distance";
import type { GeocodeResult } from "@/shared/types";

// BE-07 — geocoding server-side via Nominatim: User-Agent identificado,
// máx 1 req/s (mesma mecânica de fila da BGG) e cache Postgres por 30 dias.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias
const NOMINATIM_BUCKET = { capacity: 1, refillPerSec: 1 };

function userAgent() {
  return `JogaJunto-MVP/0.1 (${process.env.NOMINATIM_EMAIL ?? "contato@jogajunto.app"})`;
}

interface NominatimAddress {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  suburb?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  state?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

function toResult(place: NominatimPlace): GeocodeResult | null {
  const addr = place.address ?? {};
  const city = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? null;
  if (!city) return null;
  const neighborhood =
    addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.city_district ?? null;
  return {
    city,
    neighborhood,
    // trunca a 3 casas (~110 m) ANTES de qualquer persistência — privacidade extra
    lat: roundCoord(parseFloat(place.lat)),
    lng: roundCoord(parseFloat(place.lon)),
    label: neighborhood ? `${neighborhood}, ${city}` : city,
  };
}

async function nominatimFetch(path: string): Promise<unknown> {
  const gotToken = await waitForToken("nominatim", NOMINATIM_BUCKET, 15_000);
  if (!gotToken) {
    throw new ApiError(
      503,
      "geocode_unavailable",
      "Serviço de localização ocupado. Tente novamente.",
    );
  }
  const res = await fetch(`${NOMINATIM_BASE}${path}`, {
    headers: { "User-Agent": userAgent(), Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new ApiError(
      503,
      "geocode_unavailable",
      "Não foi possível resolver a localização agora.",
    );
  }
  return res.json();
}

async function withCache(key: string, fn: () => Promise<GeocodeResult | null>) {
  const cached = await prisma.geocodeCache.findUnique({ where: { key } });
  if (cached && Date.now() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
    return cached.payload as unknown as GeocodeResult | null;
  }
  const result = await fn();
  await prisma.geocodeCache.upsert({
    where: { key },
    create: { key, payload: ((result ?? null) as object | null) ?? {} },
    update: { payload: ((result ?? null) as object | null) ?? {}, cachedAt: new Date() },
  });
  return result;
}

/** Forward: "Pinheiros, São Paulo" → {city, neighborhood, lat, lng} */
export async function geocodeForward(query: string): Promise<GeocodeResult | null> {
  const q = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (q.length < 3) return null;
  const result = await withCache(`q:${q}`, async () => {
    const params = new URLSearchParams({
      q,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
      countrycodes: "br",
      "accept-language": "pt-BR",
    });
    const data = (await nominatimFetch(`/search?${params}`)) as NominatimPlace[];
    return data.length > 0 ? toResult(data[0]) : null;
  });
  // cache pode guardar {} para "não encontrado"
  return result && "city" in (result as object) ? result : null;
}

/** Reverse: coords do browser (Geolocation API) → cidade/bairro */
export async function geocodeReverse(lat: number, lng: number): Promise<GeocodeResult | null> {
  const rLat = roundCoord(lat);
  const rLng = roundCoord(lng);
  const result = await withCache(`r:${rLat},${rLng}`, async () => {
    const params = new URLSearchParams({
      lat: String(rLat),
      lon: String(rLng),
      format: "jsonv2",
      addressdetails: "1",
      "accept-language": "pt-BR",
    });
    const data = (await nominatimFetch(`/reverse?${params}`)) as NominatimPlace;
    return data && data.lat ? toResult(data) : null;
  });
  return result && "city" in (result as object) ? result : null;
}
