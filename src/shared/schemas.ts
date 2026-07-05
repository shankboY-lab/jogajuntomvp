import { z } from "zod";

// Schemas Zod compartilhados entre UI e API (decisão de arquitetura §1).

export const RADIUS_OPTIONS = [2, 5, 10, 25] as const;

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
    radiusKm: z.union([z.literal(2), z.literal(5), z.literal(10), z.literal(25)]),
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
export const collectionAddSchema = z.object({ bggId: bggIdSchema });
export const intentCreateSchema = z.object({ bggId: bggIdSchema });

/** BE-12 — busca (modos A e B) */
export const searchQuerySchema = z.object({
  mode: z.enum(["A", "B"]),
  bggId: bggIdSchema,
  radius: z.coerce
    .number()
    .refine((r) => (RADIUS_OPTIONS as readonly number[]).includes(r), "Raio inválido")
    .optional(),
});

/** BE-13 */
export const interestCreateSchema = z.object({
  toUserId: z.string().min(1),
  bggId: bggIdSchema,
});
export const interestRespondSchema = z.object({
  action: z.enum(["accept", "decline"]),
});

/** BE-16 — enum de eventos do funil */
export const EVENT_NAMES = [
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
