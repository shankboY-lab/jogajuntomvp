-- ============================================================
-- v3 / INF-07 + DB-07 + DB-08
-- Refactor da PK de Game para `id` interno (cuid), com bggId virando atributo
-- de origem opcional. Migração expand -> backfill -> contract (sem downtime),
-- com verificação anti-órfã que aborta se algum backfill deixar game_id NULL.
-- ============================================================

-- INF-07 — extensões: pg_trgm (dedup/reserva DB-08) e pgcrypto (gen_random_uuid).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "GameSource" AS ENUM ('BGG', 'USER_CREATED');

-- ============ EXPAND ============
-- games: nova PK interna + colunas v3 (RF-32/34/54).
ALTER TABLE "games" ADD COLUMN "id" TEXT;
UPDATE "games" SET "id" = gen_random_uuid()::text WHERE "id" IS NULL;
ALTER TABLE "games" ADD COLUMN "min_players" INTEGER;
ALTER TABLE "games" ADD COLUMN "max_players" INTEGER;
ALTER TABLE "games" ADD COLUMN "source" "GameSource" NOT NULL DEFAULT 'BGG';
ALTER TABLE "games" ADD COLUMN "created_by_id" TEXT;

-- game_id nullable nas satélites durante o backfill.
ALTER TABLE "user_games" ADD COLUMN "game_id" TEXT;
ALTER TABLE "play_intents" ADD COLUMN "game_id" TEXT;
ALTER TABLE "interest_requests" ADD COLUMN "game_id" TEXT;
ALTER TABLE "matches" ADD COLUMN "game_id" TEXT;

-- ============ BACKFILL ============
UPDATE "user_games" ug       SET "game_id" = g."id" FROM "games" g WHERE g."bgg_id" = ug."bgg_id";
UPDATE "play_intents" pi      SET "game_id" = g."id" FROM "games" g WHERE g."bgg_id" = pi."bgg_id";
UPDATE "interest_requests" ir SET "game_id" = g."id" FROM "games" g WHERE g."bgg_id" = ir."bgg_id";
UPDATE "matches" m            SET "game_id" = g."id" FROM "games" g WHERE g."bgg_id" = m."bgg_id";

-- Verificação anti-órfã (INF-07): aborta a migration se qualquer linha ficou sem game_id.
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT
      (SELECT count(*) FROM "user_games"        WHERE "game_id" IS NULL)
    + (SELECT count(*) FROM "play_intents"       WHERE "game_id" IS NULL)
    + (SELECT count(*) FROM "interest_requests"  WHERE "game_id" IS NULL)
    + (SELECT count(*) FROM "matches"            WHERE "game_id" IS NULL)
    INTO orphans;
  IF orphans > 0 THEN
    RAISE EXCEPTION 'DB-07 backfill deixou % linha(s) orfa(s) com game_id NULL', orphans;
  END IF;
END $$;

-- ============ CONTRACT ============
-- Remover FKs antigas baseadas em bgg_id (interest_requests/matches nunca tiveram FK).
ALTER TABLE "user_games"   DROP CONSTRAINT "user_games_bgg_id_fkey";
ALTER TABLE "play_intents" DROP CONSTRAINT "play_intents_bgg_id_fkey";

-- Remover PK/uniques/índices antigos que referenciam bgg_id.
ALTER TABLE "user_games" DROP CONSTRAINT "user_games_pkey";
DROP INDEX "play_intents_user_id_bgg_id_key";
DROP INDEX "play_intents_bgg_id_status_expires_at_idx";
DROP INDEX "interest_requests_from_user_id_to_user_id_bgg_id_key";
DROP INDEX "matches_user_lo_id_user_hi_id_bgg_id_key";

-- games: trocar a PK (bgg_id -> id); bgg_id vira unique nullable.
ALTER TABLE "games" DROP CONSTRAINT "games_pkey";
ALTER TABLE "games" ALTER COLUMN "bgg_id" DROP NOT NULL;
ALTER TABLE "games" ADD CONSTRAINT "games_pkey" PRIMARY KEY ("id");
CREATE UNIQUE INDEX "games_bgg_id_key" ON "games"("bgg_id");
CREATE INDEX "games_name_idx" ON "games"("name");
CREATE INDEX "games_created_by_id_idx" ON "games"("created_by_id");

-- DB-08 — índice GIN trigram (dedup pg_trgm + busca no banco reserva).
CREATE INDEX "games_name_trgm" ON "games" USING gin ("name" gin_trgm_ops);

-- Satélites: dropar bgg_id, tornar game_id NOT NULL e recriar chaves.
ALTER TABLE "user_games" DROP COLUMN "bgg_id";
ALTER TABLE "user_games" ALTER COLUMN "game_id" SET NOT NULL;
ALTER TABLE "user_games" ADD CONSTRAINT "user_games_pkey" PRIMARY KEY ("user_id", "game_id");

ALTER TABLE "play_intents" DROP COLUMN "bgg_id";
ALTER TABLE "play_intents" ALTER COLUMN "game_id" SET NOT NULL;
CREATE UNIQUE INDEX "play_intents_user_id_game_id_key" ON "play_intents"("user_id", "game_id");
CREATE INDEX "play_intents_game_id_status_expires_at_idx" ON "play_intents"("game_id", "status", "expires_at");

ALTER TABLE "interest_requests" DROP COLUMN "bgg_id";
ALTER TABLE "interest_requests" ALTER COLUMN "game_id" SET NOT NULL;
CREATE UNIQUE INDEX "interest_requests_from_user_id_to_user_id_game_id_key" ON "interest_requests"("from_user_id", "to_user_id", "game_id");

ALTER TABLE "matches" DROP COLUMN "bgg_id";
ALTER TABLE "matches" ALTER COLUMN "game_id" SET NOT NULL;
CREATE UNIQUE INDEX "matches_user_lo_id_user_hi_id_game_id_key" ON "matches"("user_lo_id", "user_hi_id", "game_id");

-- FKs novas -> games(id).
ALTER TABLE "games"             ADD CONSTRAINT "games_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_games"        ADD CONSTRAINT "user_games_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "play_intents"      ADD CONSTRAINT "play_intents_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interest_requests" ADD CONSTRAINT "interest_requests_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "matches"           ADD CONSTRAINT "matches_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
