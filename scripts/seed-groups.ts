/* eslint-disable no-console */
// DB-13 (v3) — popula grupos de exemplo SEM apagar o catálogo. Idempotente:
// remove os grupos marcados "[seed]" antes de recriar. Uso:
//   DATABASE_URL=... npx tsx scripts/seed-groups.ts
// Deixa /explorar, /busca/[gameId] (modo A), /grupos/[id] e /convites navegáveis.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const TTL = 14 * 24 * 60 * 60 * 1000;

async function main() {
  const demo = await prisma.user.findFirstOrThrow({ where: { email: "demo@jogajunto.app" } });
  const users = await prisma.user.findMany({
    where: { email: { endsWith: "@seed.jogajunto.app" }, profile: { isNot: null } },
    orderBy: { email: "asc" },
    take: 8,
  });
  if (users.length < 5) throw new Error("Poucos usuários de seed — rode `npm run db:seed` antes.");

  const catan = await prisma.game.findFirstOrThrow({ where: { bggId: 13 } });
  const wingspan = await prisma.game.findFirstOrThrow({ where: { bggId: 266192 } });

  console.log("🧹 Limpando grupos de seed anteriores…");
  await prisma.group.deleteMany({ where: { name: { startsWith: "[seed]" } } });

  const ensureColl = (userId: string, gameId: string) =>
    prisma.userGame.upsert({
      where: { userId_gameId: { userId, gameId } },
      create: { userId, gameId },
      update: {},
    });

  // 1) aberto vazio (Catan) — aparece na busca A de Catan e no /explorar
  await ensureColl(users[0].id, catan.id);
  await prisma.group.create({
    data: {
      creatorId: users[0].id,
      gameId: catan.id,
      name: "[seed] Catan no domingo",
      slots: 3,
      expiresAt: new Date(Date.now() + TTL),
    },
  });

  // 2) meio cheio (Wingspan) — 1 membro
  await ensureColl(users[1].id, wingspan.id);
  const g2 = await prisma.group.create({
    data: {
      creatorId: users[1].id,
      gameId: wingspan.id,
      name: "[seed] Wingspan à tarde",
      slots: 3,
      expiresAt: new Date(Date.now() + TTL),
    },
  });
  const [lo, hi] = [users[1].id, users[2].id].sort();
  const match = await prisma.match.upsert({
    where: { userLoId_userHiId_gameId: { userLoId: lo, userHiId: hi, gameId: wingspan.id } },
    create: { userLoId: lo, userHiId: hi, gameId: wingspan.id },
    update: {},
  });
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId: g2.id, userId: users[2].id } },
    create: { groupId: g2.id, userId: users[2].id, matchId: match.id },
    update: {},
  });

  // 3) grupo do DEMO (Catan) com 1 pedido pendente — visão criador + inbox
  const g3 = await prisma.group.create({
    data: {
      creatorId: demo.id,
      gameId: catan.id,
      name: "[seed] Minha mesa de Catan",
      slots: 4,
      expiresAt: new Date(Date.now() + TTL),
    },
  });
  await prisma.groupJoinRequest.upsert({
    where: { groupId_fromUserId: { groupId: g3.id, fromUserId: users[3].id } },
    create: { groupId: g3.id, fromUserId: users[3].id, status: "PENDING" },
    update: { status: "PENDING" },
  });

  // 4) expirado (Catan)
  await ensureColl(users[4].id, catan.id);
  await prisma.group.create({
    data: {
      creatorId: users[4].id,
      gameId: catan.id,
      name: "[seed] Mesa expirada",
      slots: 2,
      status: "EXPIRED",
      expiresAt: new Date(Date.now() - TTL),
    },
  });

  // 5) notificação não lida para o demo (topo da inbox)
  await prisma.notification.create({
    data: {
      userId: demo.id,
      type: "group_full",
      payload: { groupId: g3.id, groupName: g3.name, gameId: catan.id },
    },
  });

  console.log(
    "✅ Grupos de seed: aberto, meio-cheio, do demo (c/ pedido), expirado + 1 notificação.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
