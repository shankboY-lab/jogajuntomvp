import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/server/auth";
import { requestLogger } from "@/server/logger";
import { isFeatureEnabled, type FeatureFlag } from "@/shared/flags";

/** Erro de API com status HTTP + código estável para o cliente. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as unknown as Record<string, unknown>, init);
}

export function fail(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status });
}

/**
 * INF-08 — guarda de feature flag. Com a flag desligada a rota se comporta como
 * inexistente (404), nunca vazando a existência da feature v3.
 */
export function requireFeature(flag: FeatureFlag): void {
  if (!isFeatureEnabled(flag)) {
    throw new ApiError(404, "not_found", "Recurso não encontrado.");
  }
}

/** Sessão obrigatória — lança 401 (tratado pelo withApi). */
export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) throw new ApiError(401, "unauthorized", "Faça login para continuar.");
  return { userId, session };
}

type Handler<Ctx> = (req: Request, ctx: Ctx) => Promise<Response>;

/**
 * INF-05/INF-06 — wrapper padrão: requestId, log estruturado e sanitização de
 * erros (stack nunca vaza para o cliente).
 */
export function withApi<Ctx = unknown>(route: string, handler: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    const requestId = crypto.randomUUID().slice(0, 8);
    const log = requestLogger(requestId, route);
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status >= 500) log.error({ err: err.message, code: err.code });
        return fail(err.status, err.code, err.message, err.extra);
      }
      if (err instanceof ZodError) {
        return fail(422, "validation_error", "Dados inválidos.", {
          issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        });
      }
      log.error({ err: err instanceof Error ? err.message : String(err) });
      return fail(500, "internal_error", "Algo deu errado. Tente novamente.", { requestId });
    }
  };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "unknown";
}
