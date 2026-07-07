"use client";

// FE-22 — card de grupo nos resultados (v3-09, RF-42/43): filete primary, badge
// 👥 GRUPO, barra de vagas, distância do criador, pedido de entrada (BE-25) com
// estados enviado/pendente idênticos ao InterestButton v2.

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useRequestJoinGroup } from "@/lib/hooks";
import type { GroupRequestState, GroupResultItem } from "@/shared/types";

export function GroupResultCard({ item }: { item: GroupResultItem }) {
  const { toast } = useToast();
  const requestJoin = useRequestJoinGroup();
  const [state, setState] = useState<GroupRequestState>(item.myRequestState);

  const slotsLeft = Math.max(0, item.slotsTotal - item.slotsFilled);
  const pct = item.slotsTotal > 0 ? (item.slotsFilled / item.slotsTotal) * 100 : 0;

  const onJoin = async () => {
    setState("pending"); // optimistic
    try {
      await requestJoin.mutateAsync(item.groupId);
      toast(`Pedido enviado para a mesa de ${item.creator.displayName}!`, "success");
    } catch (err) {
      setState(item.myRequestState);
      toast(err instanceof Error ? err.message : "Erro ao enviar pedido", "error");
    }
  };

  return (
    <Card className="flex flex-col gap-2.5 border-l-4 border-l-primary">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary-dark">
          👥 GRUPO
        </span>
        <span className="text-xs text-muted">📍 {item.approxDistance}</span>
      </div>

      <div className="flex items-center gap-3">
        <Avatar name={item.creator.displayName} photoUrl={item.creator.photoUrl} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{item.name}</p>
          <p className="truncate text-xs text-muted">
            Mesa de {item.creator.displayName} · {item.game.name}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            {item.slotsFilled}/{item.slotsTotal} na mesa
          </span>
          <span className="font-semibold text-primary-dark">
            {slotsLeft} {slotsLeft === 1 ? "vaga livre" : "vagas livres"}
          </span>
        </div>
        <div
          className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-dark"
          role="progressbar"
          aria-valuenow={item.slotsFilled}
          aria-valuemin={0}
          aria-valuemax={item.slotsTotal}
          aria-label="Vagas preenchidas"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {state === "member" ? (
        <Link
          href={`/grupos/${item.groupId}`}
          className="rounded-input bg-cream-dark px-3 py-2 text-center text-xs font-bold text-primary-dark"
        >
          🎉 Você está na mesa →
        </Link>
      ) : state === "pending" ? (
        <span className="inline-flex items-center justify-center gap-1 rounded-input border border-line px-3 py-2 text-xs font-semibold text-muted">
          🕐 Pedido enviado
        </span>
      ) : (
        <Button loading={requestJoin.isPending} onClick={onJoin}>
          Quero entrar
        </Button>
      )}
    </Card>
  );
}
