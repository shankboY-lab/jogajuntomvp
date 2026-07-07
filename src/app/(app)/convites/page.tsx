"use client";

// FE-11 + FE-24 — convites & matches (v2-07 / v3-11, RF-23/45/53): tabs
// Recebidos/Enviados/Matches + seções de grupo + notificações de ciclo de vida.
// Polling leve (30s + focus). Shape v2 das 3 tabs preservado (aditivo).

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
import {
  useInbox,
  useRespondInterest,
  useRespondGroupRequest,
  useMarkNotificationRead,
} from "@/lib/hooks";
import { usePageView } from "@/lib/track";
import type { InboxGroupRequestReceived, InboxNotification } from "@/shared/types";

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
      if (result.outcome === "matched" && result.matchId) router.push(`/match/${result.matchId}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao aceitar convite", "error");
    }
  };
  const onDecline = (id: string) => respond.mutate({ id, action: "decline" });

  const receivedBadge = (data?.counts.received ?? 0) + (data?.counts.groupRequests ?? 0);
  const groupReceived = data?.groupRequests.received ?? [];
  const groupSent = data?.groupRequests.sent ?? [];
  const notifications = data?.notifications ?? [];

  return (
    <div className="flex flex-col gap-4 pb-6">
      <h1 className="text-2xl font-extrabold">Convites &amp; Matches</h1>

      {/* notificações de ciclo de vida no topo (v3-11) */}
      {notifications.length > 0 && (
        <ul className="flex flex-col gap-2">
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationCard notif={n} />
            </li>
          ))}
        </ul>
      )}

      <Tabs
        tabs={[
          { key: "received", label: "Recebidos", badge: receivedBadge || undefined },
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
          {tab === "received" && (
            <div className="flex flex-col gap-4">
              {/* interesses recebidos (v2) */}
              <section className="flex flex-col gap-3">
                {data?.received.length ? (
                  data.received.map((item) => (
                    <Card key={item.id} className="flex flex-col gap-3">
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
                  ))
                ) : groupReceived.length === 0 ? (
                  <EmptyState
                    icon="📬"
                    title="Nenhum convite recebido"
                    description="Quando alguém quiser jogar com você, aparece aqui."
                  />
                ) : null}
              </section>

              {/* pedidos de entrada no seu grupo (v3) */}
              {groupReceived.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                    Querem entrar no seu grupo
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {groupReceived.map((r) => (
                      <li key={r.requestId}>
                        <GroupRequestCard req={r} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

          {tab === "sent" && (
            <div className="flex flex-col gap-4">
              <section className="flex flex-col gap-3">
                {data?.sent.length ? (
                  data.sent.map((item) => (
                    <Card key={item.id} className="flex items-center gap-3">
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
                  ))
                ) : groupSent.length === 0 ? (
                  <EmptyState
                    icon="✉️"
                    title="Nenhum convite enviado"
                    description="Busque um jogo na home e convide alguém para jogar."
                  />
                ) : null}
              </section>

              {groupSent.length > 0 && (
                <section>
                  <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
                    Seus pedidos de grupo
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {groupSent.map((r) => (
                      <li key={r.requestId}>
                        <Link href={`/grupos/${r.groupId}`}>
                          <Card className="flex items-center gap-3">
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-dark">
                              👥 GRUPO
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{r.groupName}</p>
                              <p className="text-xs text-muted">{r.game.name}</p>
                            </div>
                            <span className="shrink-0 text-xs font-semibold text-muted">
                              {r.state === "accepted" ? "✅ na mesa" : "🕐 pendente"}
                            </span>
                          </Card>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}

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

function GroupRequestCard({ req }: { req: InboxGroupRequestReceived }) {
  const { toast } = useToast();
  const respond = useRespondGroupRequest(req.groupId);
  const slotsLeft = Math.max(0, req.slotsTotal - req.slotsFilled);

  const act = async (action: "accept" | "decline") => {
    try {
      await respond.mutateAsync({ reqId: req.requestId, action });
      if (action === "accept") toast("Pedido aceito — deu match!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Avatar name={req.user.displayName} photoUrl={req.user.photoUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <strong>{req.user.displayName}</strong> quer entrar em <strong>{req.groupName}</strong>
          </p>
          <p className="text-xs text-muted">
            {req.game.name} · {slotsLeft} {slotsLeft === 1 ? "vaga" : "vagas"}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" full loading={respond.isPending} onClick={() => act("decline")}>
          Recusar
        </Button>
        <Button
          full
          loading={respond.isPending}
          disabled={slotsLeft <= 0}
          onClick={() => act("accept")}
        >
          Aceitar
        </Button>
      </div>
    </Card>
  );
}

function notifMessage(n: InboxNotification): string {
  const name = (n.payload?.groupName as string) ?? "seu grupo";
  switch (n.type) {
    case "group_full":
      return `🎉 A mesa "${name}" está completa!`;
    case "group_cancelled":
      return `O grupo "${name}" foi cancelado.`;
    case "group_expired":
      return `O grupo "${name}" expirou.`;
    case "member_left":
      return `Uma vaga reabriu em "${name}".`;
    case "member_removed":
      return `Você saiu da mesa "${name}".`;
    default:
      return `Atualização em "${name}".`;
  }
}

function NotificationCard({ notif }: { notif: InboxNotification }) {
  const markRead = useMarkNotificationRead();
  const groupId = notif.payload?.groupId as string | undefined;
  const href = groupId ? `/grupos/${groupId}` : "#";
  return (
    <Link
      href={href}
      onClick={() => markRead.mutate(notif.id)}
      className="flex items-center gap-3 rounded-card border border-primary/30 bg-cream-dark px-4 py-3"
    >
      <span aria-hidden className="text-lg">
        🔔
      </span>
      <p className="min-w-0 flex-1 text-sm font-medium text-primary-dark">{notifMessage(notif)}</p>
      <span aria-hidden className="text-muted">
        →
      </span>
    </Link>
  );
}
