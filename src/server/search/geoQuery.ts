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
  gameId: string;
  radiusKm: number;
  limit?: number;
  offset?: number;
}

export async function findNearbyPlayers(params: GeoQueryParams): Promise<GeoCandidate[]> {
  const { viewerId, viewerLat, viewerLng, gameId, radiusKm, limit = 50, offset = 0 } = params;
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
       AND pi.game_id = ${gameId}
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
        JOIN user_games ug2 ON ug2.game_id = ug1.game_id AND ug2.user_id = c.user_id
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

// DB-10 — busca modo C "explorar" (RF-37/38, RNF-13): mesma engine (bounding box
// + haversine), sem filtro de jogo; agrega por usuário os jogos com intent ATIVA
// (array_agg) e ordena por distância. Paginação obrigatória (id como tiebreak p/
// estabilidade sob inserções).

export interface ExploreWant {
  gameId: string;
  name: string;
}

export interface ExploreCandidate {
  userId: string;
  displayName: string;
  photoUrl: string | null;
  distanceKm: number;
  wants: ExploreWant[];
}

export interface ExploreQueryParams {
  viewerId: string;
  viewerLat: number;
  viewerLng: number;
  radiusKm: number;
  limit?: number;
  offset?: number;
}

export async function findExplorePlayers(params: ExploreQueryParams): Promise<ExploreCandidate[]> {
  const { viewerId, viewerLat, viewerLng, radiusKm, limit = 20, offset = 0 } = params;
  const box = boundingBox(viewerLat, viewerLng, radiusKm);

  const rows = await prisma.$queryRaw<
    {
      user_id: string;
      display_name: string;
      photo_url: string | null;
      dist_km: number;
      wants: ExploreWant[];
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
      WHERE p.user_id <> ${viewerId}
        AND p.completed_at IS NOT NULL
        AND p.lat BETWEEN ${box.latMin} AND ${box.latMax}
        AND p.lng BETWEEN ${box.lngMin} AND ${box.lngMax}
        AND EXISTS (
          SELECT 1 FROM play_intents pi
          WHERE pi.user_id = p.user_id AND pi.status = 'ACTIVE' AND pi.expires_at > now()
        )
    )
    SELECT
      c.user_id,
      c.display_name,
      c.photo_url,
      c.dist_km,
      coalesce(
        json_agg(
          json_build_object('gameId', g.id, 'name', g.name)
          ORDER BY g.name
        ) FILTER (WHERE g.id IS NOT NULL),
        '[]'
      ) AS wants
    FROM candidates c
    JOIN play_intents pi
      ON pi.user_id = c.user_id AND pi.status = 'ACTIVE' AND pi.expires_at > now()
    JOIN games g ON g.id = pi.game_id
    WHERE c.dist_km <= ${radiusKm}
    GROUP BY c.user_id, c.display_name, c.photo_url, c.dist_km
    ORDER BY c.dist_km ASC, c.user_id ASC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    photoUrl: r.photo_url,
    distanceKm: Number(r.dist_km),
    wants: r.wants,
  }));
}
