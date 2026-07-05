import { prisma } from "@/server/db";
import { auth } from "@/server/auth";
import { ok, withApi, clientIp } from "@/server/http";
import { assertIpLimit } from "@/server/rateLimit";
import { eventsIngestSchema } from "@/shared/schemas";

// BE-16 — POST /api/events (batch <= 20, Zod por nome). RF-26/RNF-10.
// Eventos críticos (match, contato) são gravados server-side pelos endpoints;
// o cliente só manda os de navegação.
export const POST = withApi("events.ingest", async (req) => {
  await assertIpLimit(clientIp(req), "events", 60, 60);

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const { events } = eventsIngestSchema.parse(await req.json());
  await prisma.event.createMany({
    data: events.map((e) => ({ name: e.name, props: e.props, userId })),
  });

  return ok({ ingested: events.length }, { status: 202 });
});
