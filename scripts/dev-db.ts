/* eslint-disable no-console */
// Postgres local de desenvolvimento SEM Docker (binários embutidos).
// Uso: npm run db:local  → sobe em localhost:5433 (dados em ./.pgdata).
// Aponte DATABASE_URL/DIRECT_URL para postgresql://postgres:postgres@localhost:5433/jogajunto

import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: "./.pgdata",
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
  // UTF8 explícito — o initdb no Windows herdaria WIN1252 do locale do SO
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  const alreadyInitialized = existsSync("./.pgdata/PG_VERSION");

  if (!alreadyInitialized) {
    console.log("🐘 Inicializando cluster em ./.pgdata …");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase("jogajunto");
    console.log('🐘 Banco "jogajunto" criado.');
  } catch {
    // já existe
  }
  console.log("🐘 PostgreSQL de dev rodando em localhost:5433 (Ctrl+C para parar)");

  const stop = async () => {
    console.log("\n🐘 Parando PostgreSQL…");
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  // mantém o processo vivo
  setInterval(() => {}, 1 << 30);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
