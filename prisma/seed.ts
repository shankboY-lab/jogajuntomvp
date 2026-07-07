/* eslint-disable no-console */
// DB-06 — seed de desenvolvimento: ~30 usuários fake num raio de 1–30 km de
// Pinheiros/SP (coerente com o Figma), coleções com jogos reais, intents
// ativos, pedidos pendentes e 2 matches. `npm run db:seed`.

import { PrismaClient } from "@prisma/client";
import { hash } from "@node-rs/argon2";

// Algorithm.Argon2id — const enum ambiente, inacessível com isolatedModules
const ARGON2ID = 2;

const prisma = new PrismaClient();

// Pinheiros, São Paulo
const CENTER = { lat: -23.562, lng: -46.702 };

// jogos reais (bggId canônico — RF-13)
const GAMES = [
  { bggId: 13, name: "Catan", yearPublished: 1995 },
  { bggId: 266192, name: "Wingspan", yearPublished: 2019 },
  { bggId: 9209, name: "Ticket to Ride", yearPublished: 2004 },
  { bggId: 822, name: "Carcassonne", yearPublished: 2000 },
  { bggId: 230802, name: "Azul", yearPublished: 2017 },
  { bggId: 68448, name: "7 Wonders", yearPublished: 2010 },
  { bggId: 148228, name: "Splendor", yearPublished: 2014 },
  { bggId: 167791, name: "Terraforming Mars", yearPublished: 2016 },
  { bggId: 199792, name: "Everdell", yearPublished: 2018 },
  { bggId: 92828, name: "Dixit Odyssey", yearPublished: 2011 },
  { bggId: 30549, name: "Pandemic", yearPublished: 2008 },
  { bggId: 178900, name: "Codenames", yearPublished: 2015 },
];

const FIRST_NAMES = [
  "Ana",
  "Bruno",
  "Carla",
  "Diego",
  "Elisa",
  "Felipe",
  "Gabi",
  "Hugo",
  "Iara",
  "João",
  "Karen",
  "Lucas",
  "Marina",
  "Nando",
  "Olívia",
  "Pedro",
  "Quésia",
  "Rafa",
  "Sofia",
  "Thiago",
  "Úrsula",
  "Vini",
  "Wagner",
  "Xênia",
  "Yasmin",
  "Zeca",
  "Bia",
  "Caio",
  "Duda",
  "Enzo",
];

const NEIGHBORHOODS = [
  "Pinheiros",
  "Vila Madalena",
  "Butantã",
  "Perdizes",
  "Itaim Bibi",
  "Jardins",
  "Vila Olímpia",
  "Lapa",
  "Moema",
  "Santa Cecília",
];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

/** ponto aleatório a `km` do centro (distribuição uniforme por anel) */
function pointAtKm(km: number) {
  const bearing = rand() * 2 * Math.PI;
  const latDelta = (km / 110.574) * Math.cos(bearing);
  const lngDelta = (km / (111.32 * Math.cos((CENTER.lat * Math.PI) / 180))) * Math.sin(bearing);
  return {
    lat: Math.round((CENTER.lat + latDelta) * 1000) / 1000,
    lng: Math.round((CENTER.lng + lngDelta) * 1000) / 1000,
  };
}

function pick<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  }
  return out;
}

async function main() {
  console.log("🌱 Limpando dados de seed anteriores…");
  await prisma.event.deleteMany();
  await prisma.match.deleteMany();
  await prisma.interestRequest.deleteMany();
  await prisma.playIntent.deleteMany();
  await prisma.userGame.deleteMany();
  await prisma.profile.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();
  await prisma.game.deleteMany();

  console.log("🎲 Criando catálogo de jogos…");
  await prisma.game.createMany({ data: GAMES });

  // v3/DB-07 — a FK de jogo agora é o id interno; mapeia bggId → games.id.
  const gameRows = await prisma.game.findMany({ select: { id: true, bggId: true } });
  const gameIdByBgg = new Map(gameRows.map((g) => [g.bggId as number, g.id]));
  const gid = (bggId: number): string => {
    const id = gameIdByBgg.get(bggId);
    if (!id) throw new Error(`Jogo bggId ${bggId} não está no catálogo de seed`);
    return id;
  };

  const intentTtl = 7 * 24 * 60 * 60 * 1000;
  const passwordHash = await hash("senha12345", { algorithm: ARGON2ID });

  console.log("👤 Criando usuário demo (demo@jogajunto.app / senha12345)…");
  const demo = await prisma.user.create({
    data: {
      email: "demo@jogajunto.app",
      passwordHash,
      profile: {
        create: {
          displayName: "Rodrigo",
          city: "São Paulo",
          neighborhood: "Pinheiros",
          lat: CENTER.lat,
          lng: CENTER.lng,
          radiusKm: 5,
          whatsapp: "+5511999990000",
          telegram: "rodrigo_jj",
          locationConsentAt: new Date(),
          completedAt: new Date(),
        },
      },
    },
  });
  const demoGames = [13, 266192, 230802, 148228];
  await prisma.userGame.createMany({
    data: demoGames.map((bggId) => ({ userId: demo.id, gameId: gid(bggId) })),
  });
  await prisma.playIntent.createMany({
    data: [13, 266192].map((bggId) => ({
      userId: demo.id,
      gameId: gid(bggId),
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + intentTtl),
    })),
  });

  console.log("👥 Criando 30 usuários fake (1–30 km de Pinheiros)…");
  const users: { id: string; games: number[] }[] = [];
  for (let i = 0; i < 30; i++) {
    const name = FIRST_NAMES[i];
    const km = 1 + (i / 29) * 29; // espalha 1..30 km
    const point = pointAtKm(km);
    const games = pick(GAMES, 2 + Math.floor(rand() * 4)).map((g) => g.bggId);
    const hasWhats = rand() > 0.25;
    const hasTele = !hasWhats || rand() > 0.5;

    const user = await prisma.user.create({
      data: {
        email: `${name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}${i}@seed.jogajunto.app`,
        passwordHash,
        profile: {
          create: {
            displayName: name,
            city: "São Paulo",
            neighborhood: NEIGHBORHOODS[i % NEIGHBORHOODS.length],
            lat: point.lat,
            lng: point.lng,
            radiusKm: [2, 5, 10, 25][i % 4],
            whatsapp: hasWhats ? `+55119${String(88880000 + i)}` : null,
            telegram: hasTele ? `${name.toLowerCase()}_jj${i}` : null,
            locationConsentAt: new Date(),
            completedAt: new Date(),
          },
        },
      },
    });
    await prisma.userGame.createMany({
      data: games.map((bggId) => ({ userId: user.id, gameId: gid(bggId) })),
    });

    // ~70% têm intent ativo em 1-2 jogos da coleção; alguns expirados p/ testar DB-04
    const intentGames = pick(games, rand() > 0.3 ? (rand() > 0.5 ? 2 : 1) : 0);
    for (const bggId of intentGames) {
      const expired = rand() < 0.15;
      await prisma.playIntent.create({
        data: {
          userId: user.id,
          gameId: gid(bggId),
          status: "ACTIVE",
          expiresAt: expired
            ? new Date(Date.now() - 24 * 60 * 60 * 1000)
            : new Date(Date.now() + intentTtl),
        },
      });
    }
    users.push({ id: user.id, games });
  }

  console.log("✉️ Criando pedidos pendentes e matches…");
  const catanPlayers = users.filter((u) => u.games.includes(13)).slice(0, 4);
  const wingspanPlayers = users.filter((u) => u.games.includes(266192)).slice(0, 3);

  // pedidos pendentes PARA o demo (inbox recebidos)
  for (const u of catanPlayers.slice(0, 2)) {
    await prisma.playIntent.upsert({
      where: { userId_gameId: { userId: u.id, gameId: gid(13) } },
      create: {
        userId: u.id,
        gameId: gid(13),
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + intentTtl),
      },
      update: { status: "ACTIVE", expiresAt: new Date(Date.now() + intentTtl) },
    });
    await prisma.interestRequest.create({
      data: { fromUserId: u.id, toUserId: demo.id, gameId: gid(13) },
    });
  }

  // pedido enviado PELO demo (inbox enviados)
  if (wingspanPlayers[0]) {
    await prisma.playIntent.upsert({
      where: { userId_gameId: { userId: wingspanPlayers[0].id, gameId: gid(266192) } },
      create: {
        userId: wingspanPlayers[0].id,
        gameId: gid(266192),
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + intentTtl),
      },
      update: { status: "ACTIVE", expiresAt: new Date(Date.now() + intentTtl) },
    });
    await prisma.interestRequest.create({
      data: { fromUserId: demo.id, toUserId: wingspanPlayers[0].id, gameId: gid(266192) },
    });
  }

  // 2 matches prontos para o demo (tab Matches + tela v2-08)
  const matchPartners = [catanPlayers[2], wingspanPlayers[1]].filter(Boolean);
  const matchGames = [13, 266192];
  for (let i = 0; i < matchPartners.length; i++) {
    const partner = matchPartners[i];
    const gameId = gid(matchGames[i]);
    const [lo, hi] = demo.id < partner.id ? [demo.id, partner.id] : [partner.id, demo.id];
    await prisma.interestRequest.upsert({
      where: { fromUserId_toUserId_gameId: { fromUserId: partner.id, toUserId: demo.id, gameId } },
      create: { fromUserId: partner.id, toUserId: demo.id, gameId, status: "ACCEPTED" },
      update: { status: "ACCEPTED" },
    });
    await prisma.match.create({ data: { userLoId: lo, userHiId: hi, gameId } });
  }

  console.log("✅ Seed completo: 31 usuários, catálogo, intents, pedidos e 2 matches.");
  console.log("   Login demo: demo@jogajunto.app / senha12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
