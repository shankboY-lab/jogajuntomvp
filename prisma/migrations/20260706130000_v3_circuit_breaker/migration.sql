-- v3/BE-18 — estado compartilhado do circuit breaker do proxy BGG.
CREATE TABLE "circuit_breakers" (
    "key" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'closed',
    "failures" INTEGER NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "circuit_breakers_pkey" PRIMARY KEY ("key")
);
