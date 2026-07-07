import { ok, fail, withApi, requireUser, requireFeature, clientIp } from "@/server/http";
import { assertIpLimit, assertUserLimit } from "@/server/rateLimit";
import { isBggDown } from "@/server/bgg/breaker";
import { findGameDuplicates, createManualGame } from "@/server/games/manual";
import { recomputeProfileComplete } from "@/server/profile/complete";
import { manualGameSchema } from "@/shared/schemas";

// BE-20 — POST /api/games (cadastro manual, RF-31/32/33/34, RNF-12).
// Guardas em ordem: flag ativa -> breaker aberto (403) -> dedup (409) ->
// rate limit 5/dia (só quando de fato cria) -> cria + adiciona à coleção.
export const POST = withApi("games.create", async (req) => {
  requireFeature("manualGames");
  const { userId } = await requireUser();
  await assertIpLimit(clientIp(req), "games", 10, 60);

  // RF-31 — cadastro manual só é permitido com a BGG fora (breaker aberto),
  // validado no servidor: a UI defasada recebe 403 tratado.
  if (!(await isBggDown())) {
    return fail(
      403,
      "manual_disabled",
      "O cadastro manual só fica disponível quando o BoardGameGeek está fora do ar.",
    );
  }

  const input = manualGameSchema.parse(await req.json());

  // RF-33 — dedup por similaridade; sem force, devolve candidatos p/ confirmar.
  if (!input.force) {
    const candidates = await findGameDuplicates(input.name);
    if (candidates.length > 0) {
      return fail(409, "possible_duplicate", "Será que já temos esse jogo?", { candidates });
    }
  }

  // RNF-12 — no máximo 5 jogos criados por dia (consome token só na criação).
  await assertUserLimit(
    userId,
    "games",
    5,
    86_400,
    "Você já cadastrou muitos jogos hoje. Tente novamente amanhã.",
  );

  const game = await createManualGame(userId, input);
  const profileComplete = await recomputeProfileComplete(userId);
  return ok({ game, profileComplete }, { status: 201 });
});
