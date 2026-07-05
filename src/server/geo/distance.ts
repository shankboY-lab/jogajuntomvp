// DB-03/RNF-07 — haversine + formatação de distância aproximada.

const EARTH_RADIUS_KM = 6371;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * RNF-07 — formato definido na doc §4:
 * < 1 km → arredonda para 100 m ("a ~600 m"); >= 1 km → 1 casa decimal ("a ~1,2 km").
 * Coordenadas jamais serializadas — só esta string sai do backend.
 */
export function formatApproxDistance(km: number): string {
  if (km < 1) {
    const meters = Math.max(100, Math.round(km * 10) * 100);
    if (meters >= 1000) return "a ~1,0 km";
    return `a ~${meters} m`;
  }
  return `a ~${km.toFixed(1).replace(".", ",")} km`;
}

/** Pré-filtro por bounding box (DB-03) para a busca usar o índice (lat,lng). */
export function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return {
    latMin: lat - latDelta,
    latMax: lat + latDelta,
    lngMin: lng - lngDelta,
    lngMax: lng + lngDelta,
  };
}

/** BE-07 — trunca coordenadas a 3 casas (~110 m) antes de persistir (privacidade extra). */
export function roundCoord(value: number): number {
  return Math.round(value * 1000) / 1000;
}
