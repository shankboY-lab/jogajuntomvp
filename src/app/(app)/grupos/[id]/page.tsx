"use client";

// FE-23 — tela do grupo (v3-10, RF-44..48). Visão criador (pedidos, membros,
// remover, cancelar) e visão membro/visitante (vagas, meu estado, sair, contato
// do criador). Polling 30s (useGroup). O aceite da última vaga muda a tela para
// "grupo completo" sem reload (invalidação da query).

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import {
  useGroup,
  useRespondGroupRequest,
  useCancelGroup,
  useLeaveOrRemoveMember,
  useRequestJoinGroup,
} from "@/lib/hooks";
import { usePageView } from "@/lib/track";
import { ApiClientError } from "@/lib/api";
import type { GroupStatus } from "@/shared/types";

const STATUS_LABEL: Record<GroupStatus, { text: string; cls: string }> = {
  OPEN: { text: "Aberto", cls: "bg-whatsapp-dark text-white" },
  FULL: { text: "Mesa completa", cls: "bg-primary text-white" },
  CANCELLED: { text: "Cancelado", cls: "bg-danger text-white" },
  EXPIRED: { text: "Expirado", cls: "bg-ink text-white" },
};

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { data: session } = useSession();
  usePageView("grupo_detalhe");

  const myUserId = session?.user?.id;
  const { data: group, isLoading, isError, refetch } = useGroup(id);
  const respond = useRespondGroupRequest(id);
  const cancelGroup = useCancelGroup();
  const leaveOrRemove = useLeaveOrRemoveMember();
  const requestJoin = useRequestJoinGroup();

  const [confirm, setConfirm] = useState<
    { kind: "cancel" } | { kind: "leave" } | { kind: "remove"; userId: string; name: string } | null
  >(null);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (isError || !group) {
    return (
      <EmptyState icon="😕" title="Grupo não encontrado">
        <Button variant="outline" onClick={() => refetch()}>
          Tentar novamente
        </Button>
        <Link href="/home" className="text-sm font-semibold text-primary-dark hover:underline">
          Voltar para a home
        </Link>
      </EmptyState>
    );
  }

  const slotsLeft = Math.max(0, group.slotsTotal - group.slotsFilled);
  const status = STATUS_LABEL[group.status];

  const onAccept = async (reqId: string) => {
    try {
      const r = await respond.mutateAsync({ reqId, action: "accept" });
      toast(r.becameFull ? "Mesa completa! 🎉" : "Pedido aceito — deu match!", "success");
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "group_full") {
        toast("As vagas acabaram de encher.", "info");
        refetch();
        return;
      }
      toast(err instanceof Error ? err.message : "Erro ao aceitar", "error");
    }
  };
  const onDecline = async (reqId: string) => {
    try {
      await respond.mutateAsync({ reqId, action: "decline" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao recusar", "error");
    }
  };

  const doCancel = async () => {
    try {
      await cancelGroup.mutateAsync(id);
      toast("Grupo cancelado.", "info");
      setConfirm(null);
      router.push("/home");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao cancelar", "error");
    }
  };
  const doLeaveOrRemove = async (userId: string, isSelf: boolean) => {
    try {
      await leaveOrRemove.mutateAsync({ groupId: id, userId });
      toast(isSelf ? "Você saiu do grupo." : "Membro removido.", "info");
      setConfirm(null);
      if (isSelf) router.push("/home");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro", "error");
    }
  };
  const doJoin = async () => {
    try {
      await requestJoin.mutateAsync(id);
      toast("Pedido enviado ao criador!", "success");
      refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao pedir entrada", "error");
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex size-11 items-center justify-center rounded-full bg-white shadow-sm"
        >
          ←
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg leading-tight font-extrabold">{group.name}</h1>
          <p className="truncate text-xs text-muted">{group.game.name}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status.cls}`}>
          {status.text}
        </span>
      </header>

      {/* vagas + criador */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={group.creator.displayName} photoUrl={group.creator.photoUrl} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              Mesa de {group.creator.displayName}
              {group.isCreator ? " (você)" : ""}
            </p>
            <p className="text-xs text-muted">
              📍 {group.approxDistance || "distância indisponível"}
            </p>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>
              {group.slotsFilled}/{group.slotsTotal} na mesa
            </span>
            <span className="font-semibold text-primary-dark">
              {slotsLeft} {slotsLeft === 1 ? "vaga livre" : "vagas livres"}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-dark">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(group.slotsFilled / group.slotsTotal) * 100}%` }}
            />
          </div>
        </div>
      </Card>

      {/* ===== visão CRIADOR ===== */}
      {group.isCreator ? (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Pedidos ({group.requests?.length ?? 0})
            </h2>
            {group.requests && group.requests.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {group.requests.map((r) => (
                  <li key={r.requestId}>
                    <Card className="flex items-center gap-3">
                      <Avatar name={r.user.displayName} photoUrl={r.user.photoUrl} size={40} />
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {r.user.displayName}
                      </p>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          className="px-3"
                          loading={respond.isPending}
                          onClick={() => onAccept(r.requestId)}
                          disabled={slotsLeft <= 0}
                        >
                          Aceitar
                        </Button>
                        <Button
                          variant="outline"
                          className="px-3"
                          onClick={() => onDecline(r.requestId)}
                        >
                          Recusar
                        </Button>
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nenhum pedido pendente por enquanto.</p>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
              Na mesa ({group.slotsFilled})
            </h2>
            {group.members && group.members.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {group.members.map((m) => (
                  <li key={m.userId}>
                    <Card className="flex items-center gap-3">
                      <Avatar name={m.displayName} photoUrl={m.photoUrl} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.displayName}</p>
                        <p className="text-[11px] font-semibold text-whatsapp-dark">deu match!</p>
                      </div>
                      <Link
                        href={`/match/${m.matchId}`}
                        className="shrink-0 rounded-input bg-cream-dark px-3 py-2 text-xs font-bold text-primary-dark"
                      >
                        Contato
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remover ${m.displayName}`}
                        onClick={() =>
                          setConfirm({ kind: "remove", userId: m.userId, name: m.displayName })
                        }
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-cream-dark hover:text-danger"
                      >
                        ✕
                      </button>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Ainda ninguém entrou.</p>
            )}
          </section>

          {group.status !== "CANCELLED" && (
            <Button variant="danger" full onClick={() => setConfirm({ kind: "cancel" })}>
              Cancelar grupo
            </Button>
          )}
        </>
      ) : (
        /* ===== visão MEMBRO / VISITANTE ===== */
        <Card className="flex flex-col gap-3">
          {group.myRequestState === "member" ? (
            <>
              <p className="text-sm font-semibold text-whatsapp-dark">🎉 Você está na mesa!</p>
              {group.myMatchId && (
                <Link
                  href={`/match/${group.myMatchId}`}
                  className="rounded-input bg-primary px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-primary-dark"
                >
                  Falar com {group.creator.displayName}
                </Link>
              )}
              <Button variant="outline" full onClick={() => setConfirm({ kind: "leave" })}>
                Sair do grupo
              </Button>
            </>
          ) : group.myRequestState === "pending" ? (
            <p className="text-sm font-semibold text-muted">
              🕐 Pedido enviado — aguardando o criador aceitar.
            </p>
          ) : group.status === "OPEN" ? (
            <>
              <p className="text-sm text-muted">
                {slotsLeft} {slotsLeft === 1 ? "vaga livre" : "vagas livres"} nesta mesa de{" "}
                {group.game.name}.
              </p>
              <Button full loading={requestJoin.isPending} onClick={doJoin}>
                Quero entrar
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted">Esta mesa não está aberta para novos pedidos.</p>
          )}
        </Card>
      )}

      {/* confirmações */}
      <BottomSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={
          confirm?.kind === "cancel"
            ? "Cancelar grupo?"
            : confirm?.kind === "leave"
              ? "Sair do grupo?"
              : "Remover membro?"
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted">
            {confirm?.kind === "cancel"
              ? "O grupo será cancelado e os membros avisados. Esta ação não pode ser desfeita."
              : confirm?.kind === "leave"
                ? "Você vai sair desta mesa. O contato já trocado com o criador continua disponível nos seus matches."
                : confirm?.kind === "remove"
                  ? `Remover ${confirm.name} da mesa? A vaga reabre para outra pessoa.`
                  : ""}
          </p>
          <Button
            variant="danger"
            full
            loading={cancelGroup.isPending || leaveOrRemove.isPending}
            onClick={() => {
              if (confirm?.kind === "cancel") doCancel();
              else if (confirm?.kind === "leave" && myUserId) doLeaveOrRemove(myUserId, true);
              else if (confirm?.kind === "remove") doLeaveOrRemove(confirm.userId, false);
            }}
          >
            {confirm?.kind === "cancel"
              ? "Cancelar grupo"
              : confirm?.kind === "leave"
                ? "Sair"
                : "Remover"}
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
