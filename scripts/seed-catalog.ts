/* eslint-disable no-console */
// Seed do catálogo de jogos populares — SEGURO para produção (só upserta a
// tabela games; não cria usuários fake). Uso:
//   DATABASE_URL=... npx tsx scripts/seed-catalog.ts

import { PrismaClient } from "@prisma/client";
import { CATALOG } from "../prisma/catalog";

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  for (const game of CATALOG) {
    const result = await prisma.game.upsert({
      where: { bggId: game.bggId },
      // não sobrescreve dados reais vindos da BGG (thumbnail/ano corrigido)
      update: {},
      create: { bggId: game.bggId, name: game.name, yearPublished: game.yearPublished },
    });
    if (result.cachedAt.getTime() > Date.now() - 5_000) created++;
  }
  console.log(`✅ Catálogo: ${CATALOG.length} jogos processados (${created} novos).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
