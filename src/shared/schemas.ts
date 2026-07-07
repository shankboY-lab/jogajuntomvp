import { z } from "zod";

// Schemas Zod compartilhados entre UI e API (decisão de arquitetura §1).

export const RADIUS_OPTIONS = [2, 5, 10, 25, 50] as const;
export type RadiusKm = (typeof RADIUS_OPTIONS)[number];

/** BE-02 — cadastro e-mail/senha (senha >= 8, hint do Figma v2-02) */
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "Use ao menos 8 caracteres"),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

/** Normaliza WhatsApp para E.164 (aceita "(11) 99999-9999" com DDI opcional). */
export function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // sem DDI e com cara de número BR (10-11 dígitos) → prefixa 55
  const withDdi = raw.trim().startsWith("+") || digits.length > 11 ? digits : `55${digits}`;
  if (!/^[1-9]\d{9,14}$/.test(withDdi)) return null;
  return `+${withDdi}`;
}

export function normalizeTelegram(raw: string): string | null {
  const username = raw.trim().replace(/^@/, "");
  if (!/^[a-zA-Z0-9_]{5,32}$/.test(username)) return null;
  return username;
}

/** BE-06 — perfil (RF-06..10, RF-27). >=1 contato obrigatório (§8 Gaps). */
export const profileSchema = z
  .object({
    displayName: z.string().trim().min(2, "Nome muito curto").max(40, "Nome muito longo"),
    photoUrl: z.string().url().nullish(),
    city: z.string().trim().min(1, "Informe a cidade"),
    neighborhood: z.string().trim().max(80).nullish(),
    // null no modo edição = manter a localização salva (o backend nunca
    // devolve coordenadas ao cliente — RNF-07)
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
    radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10), z.literal(25), z.literal(50)]),
    whatsapp: z.string().trim().max(30).nullish(),
    telegram: z.string().trim().max(40).nullish(),
    locationConsent: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if ((data.lat == null) !== (data.lng == null)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lat"],
        message: "Localização incompleta.",
      });
    }
    if (!data.locationConsent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["locationConsent"],
        message: "É preciso consentir com o uso da localização (mostramos só a distância).",
      });
    }
    const hasWhats = data.whatsapp && normalizeWhatsapp(data.whatsapp);
    const hasTele = data.telegram && normalizeTelegram(data.telegram);
    if (data.whatsapp && !hasWhats) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["whatsapp"],
        message: "Número inválido — use DDD + número, ex.: (11) 99999-9999",
      });
    }
    if (data.telegram && !hasTele) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["telegram"],
        message: "Username inválido — mínimo 5 caracteres, sem espaços",
      });
    }
    if (!hasWhats && !hasTele) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["whatsapp"],
        message:
          "Informe ao menos um contato (WhatsApp ou Telegram) — é ele que aparece após o match.",
      });
    }
  });
export type ProfileInput = z.infer<typeof profileSchema>;

/** BE-10/BE-11 */
export const bggIdSchema = z.coerce.number().int().positive();
/** v3/DB-07 — chave canônica de jogo é o `id` interno (cuid). */
export const gameIdSchema = z.string().min(1).max(40);

/**
 * Adição à coleção aceita `gameId` interno (jogos USER_CREATED e resultados já
 * materializados) OU `bggId` (fluxo BGG v2 — resolvido p/ id interno no servidor).
 */
export const collectionAddSchema = z.union([
  z.object({ gameId: gameIdSchema }),
  z.object({ bggId: bggIdSchema }),
]);
export const intentCreateSchema = z.object({ gameId: gameIdSchema });

/** BE-12 — busca (modos A e B). `gameId` aceita id interno ou bggId legado. */
export const searchQuerySchema = z.object({
  mode: z.enum(["A", "B"]),
  gameId: gameIdSchema,
  radius: z.coerce
    .number()
    .refine((r) => (RADIUS_OPTIONS as readonly number[]).includes(r), "Raio inválido")
    .optional(),
});

/** BE-22 — busca modo C "explorar" (sem jogo; paginada). */
export const exploreQuerySchema = z.object({
  radius: z.coerce
    .number()
    .refine((r) => (RADIUS_OPTIONS as readonly number[]).includes(r), "Raio inválido")
    .optional(),
  page: z.coerce.number().int().min(0).default(0),
});

/** BE-13 */
export const interestCreateSchema = z.object({
  toUserId: z.string().min(1),
  gameId: gameIdSchema,
});
export const interestRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

/**
 * INF-09 — sanitização de nomes de jogo/grupo: remove caracteres de controle e
 * zero-width, colapsa espaços e faz trim. Sem HTML (armazenado como texto).
 */
export function sanitizeName(raw: string): string {
  let out = "";
  for (const ch of raw) {
    const code = ch.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) continue; // controle
    if (code >= 0x200b && code <= 0x200d) continue; // zero-width space/joiner
    if (code === 0xfeff) continue; // BOM / zero-width no-break
    out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

const currentYear = new Date().getFullYear();

/** BE-20 — cadastro manual de jogo (RF-32/34). name 3–80 sanitizado. */
export const manualGameSchema = z
  .object({
    name: z
      .string()
      .transform(sanitizeName)
      .refine((v) => v.length >= 3 && v.length <= 80, "O nome deve ter de 3 a 80 caracteres."),
    yearPublished: z.coerce
      .number()
      .int()
      .min(1900, "Ano muito antigo")
      .max(currentYear + 1, "Ano no futuro")
      .nullish(),
    minPlayers: z.coerce.number().int().min(1).max(99).nullish(),
    maxPlayers: z.coerce.number().int().min(1).max(99).nullish(),
    coverUrl: z.string().url().nullish(),
    force: z.boolean().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.minPlayers != null && d.maxPlayers != null && d.minPlayers > d.maxPlayers) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxPlayers"],
        message: "O máximo de jogadores não pode ser menor que o mínimo.",
      });
    }
  });
export type ManualGameInput = z.infer<typeof manualGameSchema>;

/** BE-24 — criação de grupo (RF-41). name 3–50 sanitizado, slots 1–9 (D5). */
export const groupCreateSchema = z.object({
  gameId: gameIdSchema,
  name: z
    .string()
    .transform(sanitizeName)
    .refine((v) => v.length >= 3 && v.length <= 50, "O nome deve ter de 3 a 50 caracteres."),
  slots: z.coerce.number().int().min(1, "Mínimo 1 vaga").max(9, "Máximo 9 vagas"),
});
export type GroupCreateInput = z.infer<typeof groupCreateSchema>;

/** BE-25 — aceitar/recusar pedido de entrada em grupo. */
export const groupRequestRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

/** BE-16 + BE-28 — enum de eventos do funil (v2 + v3). */
export const EVENT_NAMES = [
  // v2
  "signup_completed",
  "profile_completed",
  "game_added",
  "intent_created",
  "search_performed",
  "search_zero_results",
  "interest_sent",
  "match_created",
  "interest_declined",
  "contact_clicked",
  "page_view",
  // v3 F1 — catálogo resiliente + cadastro manual
  "bgg_fallback_acionado",
  "busca_reserva_realizada",
  "jogo_manual_criado",
  "jogo_manual_em_match",
  // v3 F2 — explorar pessoas
  "busca_explorar_realizada",
  // v3 F3 — grupos
  "grupo_criado",
  "grupo_exibido_em_busca",
  "pedido_entrada_enviado",
  "pedido_aceito",
  "pedido_recusado",
  "grupo_completo",
  "membro_saiu",
  "membro_removido",
  "grupo_cancelado",
  "grupo_expirado",
  "contato_grupo_clicado",
  // v3 — eventos de UI que o servidor não enxerga (FE-25)
  "cta_manual_clicado",
  "sheet_jogo_aberto",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const eventsIngestSchema = z.object({
  events: z
    .array(
      z.object({
        name: z.enum(EVENT_NAMES),
        props: z.record(z.union([z.string(), z.number(), z.boolean()])).default({}),
      }),
    )
    .min(1)
    .max(20),
});

/** BE-17 — exclusão de conta (reauth) */
export const accountDeleteSchema = z.object({
  confirmation: z.literal("EXCLUIR", {
    errorMap: () => ({ message: 'Digite "EXCLUIR" para confirmar' }),
  }),
  password: z.string().optional(),
});
