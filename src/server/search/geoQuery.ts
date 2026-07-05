import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { boundingBox } from "@/server/geo/distance";

// DB-03 — busca por proximidade (RF-17/18, RNF-04/07):
// pré-filtro bounding box (usa índice profiles(lat,lng)) → haversine em SQL →
// dist <= raio do buscador → join intents ACTIVE não expirado no bggId alvo →
// exclui o próprio usuário e perfis incompletos → ORDER BY dist ASC.

export interface GeoCandidate {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  distanceKm: number;
  commonGamesCount: number;
}

export interface GeoQueryParams {
  viewerId: string;
  viewerLat: number;
  viewerLng: number;
  bggId: number;
  radiusKm: number;
  limit?: number;
  offset?: number;
}

export async function findNearbyPlayers(params: GeoQueryParams): Promise<GeoCandidate[]> {
  const { viewerId, viewerLat, viewerLng, bggId, radiusKm, limit = 50, offset = 0 } = params;
  const box = boundingBox(viewerLat, viewerLng, radiusKm);

  const rows = await prisma.$queryRaw<
    {
      user_id: string;
      display_name: string;
      photo_url: string | null;
      dist_km: number;
      common_games: number;
    }[]
  >(Prisma.sql`
    WITH candidates AS (
      SELECT
        p.user_id,
        p.display_name,
        p.photo_url,
        (6371 * acos(least(1.0,
          cos(radians(${viewerLat})) * cos(radians(p.lat)) *
          cos(radians(p.lng) - radians(${viewerLng})) +
          sin(radians(${viewerLat})) * sin(radians(p.lat))
        ))) AS dist_km
      FROM profiles p
      JOIN play_intents pi
        ON pi.user_id = p.user_id
       AND pi.bgg_id = ${bggId}
       AND pi.status = 'ACTIVE'
       AND pi.expires_at > now()
      WHERE p.user_id <> ${viewerId}
        AND p.completed_at IS NOT NULL
        AND p.lat BETWEEN ${box.latMin} AND ${box.latMax}
        AND p.lng BETWEEN ${box.lngMin} AND ${box.lngMax}
    )
    SELECT
      c.*,
      (
        SELECT count(*)::int
        FROM user_games ug1
        JOIN user_games ug2 ON ug2.bgg_id = ug1.bgg_id AND ug2.user_id = c.user_id
        WHERE ug1.user_id = ${viewerId}
      ) AS common_games
    FROM candidates c
    WHERE c.dist_km <= ${radiusKm}
    ORDER BY c.dist_km ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    photoUrl: r.photo_url,
    distanceKm: Number(r.dist_km),
    commonGamesCount: Number(r.common_games),
  }));
}
