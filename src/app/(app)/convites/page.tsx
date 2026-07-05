"use client";

// FE-11 — convites & matches (v2-07, RF-23): tabs Recebidos/Enviados/Matches,
// aceitar navega para o match, recusar remove silenciosamente (§9).
// Polling leve (30s + focus) — sem push na v1.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useInbox, useRespondInterest } from "@/lib/hooks";
import { usePageView } from "@/lib/track";

export default function InboxPage() {
  const router = useRouter();
  const { toast } = useToast();
  usePageView("convites");
  const { data, isLoading } = useInbox();
  const respond = useRespondInterest();
  const [tab, setTab] = useState("received");

  const onAccept = async (id: string) => {
    try {
      const result = await respond.mutateAsync({ id, action: "accept" });
      if (result.outcome === "matched" && result.matchId) {
        router.push(`/match/${result.matchId}`);
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao aceitar convite", "error");
    }
  };

  const onDecline = (id: string) => {
    respond.mutate({ id, action: "decline" });
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-2xl font-extrabold">Convites &amp; Matches</h1>

      <Tabs
        tabs={[
          { key: "received", label: "Recebidos", badge: data?.counts.received },
          { key: "sent", label: "Enviados" },
          { key: "matches", label: "Matches", badge: data?.counts.matches },
        ]}
        active={tab}
        onChange={setTab}
      />

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <div aria-live="polite">
          {tab === "received" &&
            (data?.received.length ? (
              <ul className="flex flex-col gap-3">
                {data.received.map((item) => (
                  <li key={item.id}>
                    <Card className="flex flex-col gap-3">
                      <div className="flex items-center gap-3">
                        <Avatar
                          name={item.user.displayName}
                          photoUrl={item.user.photoUrl}
                          size={48}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">
                            <strong>{item.user.displayName}</strong> quer jogar{" "}
                            <strong>{item.game.name}</strong>
                          </p>
                          <p className="text-xs text-muted">📍 {item.approxDistance}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" full onClick={() => onDecline(item.id)}>
                          Recusar
                        </Button>
                        <Button full onClick={() => onAccept(item.id)}>
                          Aceitar
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="📬"
                title="Nenhum convite recebido"
                description="Quando alguém quiser jogar com você, aparece aqui."
              />
            ))}

          {tab === "sent" &&
            (data?.sent.length ? (
              <ul className="flex flex-col gap-3">
                {data.sent.map((item) => (
                  <li key={item.id}>
                    <Card className="flex items-center gap-3">
                      <Avatar
                        name={item.user.displayName}
                        photoUrl={item.user.photoUrl}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          Você convidou <strong>{item.user.displayName}</strong> para jogar{" "}
                          <strong>{item.game.name}</strong>
                        </p>
                        <p className="text-xs text-muted">📍 {item.approxDistance}</p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold text-muted">🕐 Pendente</span>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="✉️"
                title="Nenhum convite enviado"
                description="Busque um jogo na home e convide alguém para jogar."
              />
            ))}

          {tab === "matches" &&
            (data?.matches.length ? (
              <ul className="flex flex-col gap-3">
                {data.matches.map((item) => (
                  <li key={item.matchId}>
                    <Card className="flex items-center gap-3">
                      <Avatar
                        name={item.user.displayName}
                        photoUrl={item.user.photoUrl}
                        size={48}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <strong>Deu match!</strong> Você e{" "}
                          <strong>{item.user.displayName}</strong> querem jogar{" "}
                          <strong>{item.game.name}</strong>
                        </p>
                        <p className="text-xs text-muted">📍 {item.approxDistance}</p>
                      </div>
                      <Link
                        href={`/match/${item.matchId}`}
                        className="shrink-0 rounded-input bg-gradient-to-r from-primary-light to-primary px-3.5 py-2.5 text-xs font-bold text-white"
                      >
                        Ver contato
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon="🤝"
                title="Nenhum match ainda"
                description="Quando um convite for aceito dos dois lados, o contato aparece aqui."
              />
            ))}
        </div>
      )}
    </div>
  );
}
