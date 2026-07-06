# JogaJunto MVP 🎲

Pareador de jogos de tabuleiro — encontre pessoas perto de você que querem jogar os mesmos jogos.

**Stack:** Next.js 15 (App Router, monólito modular) · TypeScript strict · PostgreSQL + Prisma · Auth.js v5 · Tailwind CSS v4 · TanStack Query · Vitest.

Implementação da doc técnica [`jogajunto-mvp-doc-tecnica-tarefas.md`](jogajunto-mvp-doc-tecnica-tarefas.md) (PRD v2 + Figma "MVP - JogaJunto").

---

## Rodando localmente

### 1. Pré-requisitos

- Node.js ≥ 20
- PostgreSQL (local ou gerenciado — Neon/Supabase/Railway)

### 2. Setup

```bash
npm install                 # instala dependências + prisma generate
cp .env.example .env        # e preencha DATABASE_URL/DIRECT_URL/AUTH_SECRET

# Sem Docker/Postgres instalado? Suba um Postgres embutido de dev (porta 5433):
npm run db:local            # deixe rodando num terminal separado

npm run db:migrate          # aplica as migrations
npm run db:seed             # ~30 usuários fake em Pinheiros/SP + 2 matches
npm run dev                 # http://localhost:3000
```

**Login demo (após o seed):** `demo@jogajunto.app` / `senha12345`

Google OAuth é opcional em dev — configure `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
(callback: `http://localhost:3000/api/auth/callback/google`).

### 3. Scripts

| Script                                | O que faz                                                |
| ------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                         | dev server                                               |
| `npm run build` / `start`             | build e produção                                         |
| `npm run lint` / `typecheck`          | ESLint / `tsc --noEmit`                                  |
| `npm test`                            | testes unitários (Vitest)                                |
| `npm run db:migrate:dev`              | cria/aplica migration em dev                             |
| `npm run db:seed`                     | seed de desenvolvimento (DB-06)                          |
| `npm run db:local`                    | Postgres embutido de dev, sem Docker (localhost:5433)    |
| `npm run db:studio`                   | Prisma Studio                                            |
| `npx tsx scripts/funnel.ts`           | consulta o funil (`funnel_daily`) por SQL                |
| `npx tsx scripts/import-games-csv.ts` | importa `prisma/games.csv` no catálogo (só insere novos) |

> **Nota BGG:** a XML API2 do BoardGameGeek bloqueia IPs de datacenter/cloud
> (401/403 via Cloudflare). Em rede residencial e na Vercel costuma funcionar;
> quando indisponível, o app degrada com erro isolado + retry (RF-15) e o seed
> pré-popula o catálogo para desenvolver sem depender da BGG.

---

## Arquitetura (resumo)

Ver [`arquitetura-macro-jogajunto-mvp.svg`](arquitetura-macro-jogajunto-mvp.svg) e a doc técnica. Princípios inegociáveis:

1. **Coordenadas nunca saem do backend** — a API retorna só distância formatada (`"a ~600 m"`), e coords são salvas truncadas a 3 casas (~110 m). RNF-07.
2. **Contato só pós-match** — `GET /api/matches/:id/contact` valida a participação antes de montar os links `wa.me`/`t.me`; nenhum outro endpoint serializa contato. RNF-09.
3. **BGG só server-side** — proxy com token bucket distribuído em Postgres (1 req/5s), single-flight, retry/backoff (1s→2s→4s) e cache 24h. RNF-05.
4. **Funil instrumentado desde o dia 1** — eventos server-side + `useTrack` no cliente; view SQL `funnel_daily`. RNF-10 (bloqueia go-live).

### Estrutura

```
src/
  app/(public)/        login, cadastro, termos, privacidade
  app/(app)/           home, perfil/configurar, busca/[bggId], convites, match/[id], conta
  app/api/             route handlers (contratos da doc §4)
  server/              domínios: auth, bgg, geo, search, matching, events, profile
  shared/              schemas Zod + tipos compartilhados UI↔API
  components/          design system (FE-01) + GameSearch (FE-07)
prisma/                schema, migrations, seed
tests/                 unitários QA-01 (Vitest)
```

## Deploy (Vercel) — INF-04

1. Importe o repositório na Vercel; framework: Next.js.
2. Secrets: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `NOMINATIM_EMAIL`.
3. O cron de expiração (`vercel.json`) chama `/api/cron/expire` a cada hora (DB-04).
4. Rode `npx prisma migrate deploy` no primeiro deploy (ou via `postbuild`).

## Status das tarefas da doc

**Implementado:** INF-01/02(parcial)/03/06 · DB-01..06 · BE-01..17 · FE-01..15 · QA-01 (unitários).

**Pendente (exige infraestrutura/conta):** INF-04 (projeto Vercel), INF-05 (Sentry — logger pino + `/api/health` prontos), QA-02 (integração com testcontainers), QA-03 (E2E Playwright), QA-04 (QA manual/Lighthouse). Conteúdo de Termos/Privacidade é placeholder a validar com jurídico (FE-15).
