import { prisma } from "@/server/db";
import { ok, fail, withApi } from "@/server/http";

// INF-05 — health check (ping DB)
export const GET = withApi("health", async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return ok({ status: "ok", db: "up" });
  } catch {
    return fail(503, "db_down", "Banco indisponível.");
  }
});
