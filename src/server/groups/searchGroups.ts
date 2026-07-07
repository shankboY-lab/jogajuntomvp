import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { boundingBox } from "@/server/geo/distance";
import type { GroupRequestState } from "@/shared/types";

// DB-10 (grupos) — grupos abertos nos resultados de busca (RF-42). Distância
// SEMPRE pela localização do criador (RNF-15). Exclui grupos do próprio buscador.

export interface OpenGroupCandidate {
  groupId: string;
  name: string;
  gameId: string;
  gameName: string;
  thumbnailUrl: string | null;
  creatorName: string;
  creatorPhoto: string | null;
  slotsTotal: number;
  slotsFilled: number;
  distanceKm: number;
}

export async function findOpenGroups(params: {
  viewerId: string;
  viewerLat: number;
  viewerLng: number;
  radiusKm: number;
  gameId?: string;
  limit?: number;
}): Promise<OpenGroupCandidate[]> {
  const { viewerId, viewerLat, viewerLng, radiusKm, gameId, limit = 20 } = params;
  const box = boundingBox(viewerLat, viewerLng, radiusKm);
  const gameFilter = gameId ? Prisma.sql`AND g.game_id = ${gameId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      group_id: string;
      name: string;
      game_id: string;
      game_name: string;
      thumbnail_url: string | null;
      creator_name: string;
      creator_photo: string | null;
      slots: number;
      slots_filled: number;
      dist_km: number;
    }[]
  >(Prisma.sql`
    WITH cand AS (
      SELECT
        g.id AS group_id, g.name, g.game_id, g.slots,
        gm.name AS game_name, gm.thumbnail_url,
        cp.display_name AS creator_name, cp.photo_url AS creator_photo,
        (6371 * acos(least(1.0,
          cos(radians(${viewerLat})) * cos(radians(cp.lat)) *
          cos(radians(cp.lng) - radians(${viewerLng})) +
          sin(radians(${viewerLat})) * sin(radians(cp.lat))
        ))) AS dist_km
      FROM groups g
      JOIN profiles cp ON cp.user_id = g.creator_id
      JOIN games gm ON gm.id = g.game_id
      WHERE g.status = 'OPEN'
        AND g.expires_at > now()
        AND g.creator_id <> ${viewerId}
        ${gameFilter}
        AND cp.lat BETWEEN ${box.latMin} AND ${box.latMax}
        AND cp.lng BETWEEN ${box.lngMin} AND ${box.lngMax}
    )
    SELECT c.*,
      (SELECT count(*)::int FROM group_members m WHERE m.group_id = c.group_id) AS slots_filled
    FROM cand c
    WHERE c.dist_km <= ${radiusKm}
    ORDER BY c.dist_km ASC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({
    groupId: r.group_id,
    name: r.name,
    gameId: r.game_id,
    gameName: r.game_name,
    thumbnailUrl: r.thumbnail_url,
    creatorName: r.creator_name,
    creatorPhoto: r.creator_photo,
    slotsTotal: Number(r.slots),
    slotsFilled: Number(r.slots_filled),
    distanceKm: Number(r.dist_km),
  }));
}

/** Estado do pedido do buscador em cada grupo (para o card de resultado). */
export async function getMyGroupStates(
  viewerId: string,
  groupIds: string[],
): Promise<Map<string, GroupRequestState>> {
  const map = new Map<string, GroupRequestState>();
  if (groupIds.length === 0) return map;

  const [reqs, members] = await Promise.all([
    prisma.groupJoinRequest.findMany({
      where: { fromUserId: viewerId, groupId: { in: groupIds } },
      select: { groupId: true, status: true },
    }),
    prisma.groupMember.findMany({
      where: { userId: viewerId, groupId: { in: groupIds } },
      select: { groupId: true },
    }),
  ]);

  for (const r of reqs) {
    map.set(
      r.groupId,
      r.status === "PENDING" ? "pending" : r.status === "ACCEPTED" ? "accepted" : "declined",
    );
  }
  for (const m of members) map.set(m.groupId, "member");
  return map;
}
