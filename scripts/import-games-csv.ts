/* eslint-disable no-console */
// Importa jogos de um CSV (id,name,yearpublished) para a tabela `games`.
// SEGURO para produção: só insere jogos novos (skipDuplicates) — não toca em
// registros existentes já enriquecidos pela BGG (nome/ano/thumbnail).
// Uso: DATABASE_URL=... npx tsx scripts/import-games-csv.ts [caminho/arquivo.csv]
// Padrão: prisma/games.csv (versionado no repo).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Parser CSV mínimo por linha: campos entre aspas com vírgulas e "" escapado. */
function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

async function main() {
  const csvPath = process.argv[2] ?? resolve(process.cwd(), "prisma/games.csv");
  const raw = readFileSync(csvPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);

  // detecta e pula o header (id,name,yearpublished)
  const start = /^\s*id\s*,/i.test(lines[0]) ? 1 : 0;

  const rows: { bggId: number; name: string; yearPublished: number | null }[] = [];
  const seen = new Set<number>();
  let skipped = 0;

  for (let i = start; i < lines.length; i++) {
    const [idStr, name, yearStr] = parseLine(lines[i]);
    const bggId = Number(idStr);
    if (!Number.isInteger(bggId) || bggId <= 0 || !name?.trim()) {
      skipped++;
      continue;
    }
    if (seen.has(bggId)) continue; // dedupe dentro do arquivo
    seen.add(bggId);
    const year = yearStr?.trim() ? Number(yearStr) : null;
    rows.push({
      bggId,
      name: name.trim(),
      yearPublished: Number.isFinite(year) ? year : null,
    });
  }

  console.log(`📄 CSV: ${rows.length} jogos válidos (${skipped} linhas ignoradas).`);

  const before = await prisma.game.count();

  // createMany + skipDuplicates: insere só os novos, preserva os existentes
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const res = await prisma.game.createMany({ data: batch, skipDuplicates: true });
    inserted += res.count;
    console.log(`  … ${Math.min(i + BATCH, rows.length)}/${rows.length} processados`);
  }

  const after = await prisma.game.count();
  console.log(
    `✅ Importação concluída: ${inserted} novos jogos inseridos. Catálogo: ${before} → ${after}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
