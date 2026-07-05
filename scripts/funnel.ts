/* eslint-disable no-console */
// BE-16 — leitura rápida do funil (view funnel_daily). Uso: npx tsx scripts/funnel.ts

import { PrismaClient } from "@prisma/client";

const p = new PrismaClient();

async function main() {
  const rows = await p.$queryRaw<
    { day: Date; name: string; total: bigint; unique_users: bigint }[]
  >`SELECT * FROM funnel_daily`;
  console.table(
    rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      name: r.name,
      total: Number(r.total),
      users: Number(r.unique_users),
    })),
  );
}

main().finally(() => p.$disconnect());
