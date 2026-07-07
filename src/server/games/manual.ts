import { prisma } from "@/server/db";
import { track } from "@/server/events/track";
import { searchReserve } from "@/server/games/reserve";
import { toGameSummary } from "@/server/games/catalog";
import type { GameSummary } from "@/shared/types";
import type { ManualGameInput } from "@/shared/schemas";

// BE-20 — cadastro manual de jogo (RF-32/33/34). O gatilho (breaker aberto),
// rate limit e a flag são validados na rota; aqui ficam dedup e criação.

/** Candidatos de dedup por similaridade (RF-33). Vazio = pode criar. */
export async function findGameDuplicates(name: string): Promise<GameSummary[]> {
  return searchReserve(name, { limit: 5 });
}

/** Cria o jogo USER_CREATED e já o adiciona à coleção do autor. */
export async function createManualGame(
  userId: string,
  input: ManualGameInput,
): Promise<GameSummary> {
  const game = await prisma.$transaction(async (tx) => {
    const created = await tx.game.create({
      data: {
        name: input.name,
        yearPublished: input.yearPublished ?? null,
        minPlayers: input.minPlayers ?? null,
        maxPlayers: input.maxPlayers ?? null,
        thumbnailUrl: input.coverUrl ?? null,
        source: "USER_CREATED",
        createdById: userId,
      },
    });
    await tx.userGame.upsert({
      where: { userId_gameId: { userId, gameId: created.id } },
      create: { userId, gameId: created.id },
      update: {},
    });
    return created;
  });

  await track("jogo_manual_criado", userId, { gameId: game.id, name: game.name });
  return toGameSummary(game);
}
