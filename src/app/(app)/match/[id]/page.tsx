"use client";

// FE-12 — tela de match + contato (v2-08, RF-25/26): fundo laranja
// celebratório, avatares sobrepostos, botões por canal disponível.
// O clique busca o link em /api/matches/:id/contact (que registra o evento
// contact_clicked — métrica primária) e abre via window.open.

import { use, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useMatchDetail, fetchContact } from "@/lib/hooks";
import { usePageView } from "@/lib/track";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  usePageView("match_contato");
  const { data, isLoading, isError } = useMatchDetail(id);
  const [opening, setOpening] = useState<"whatsapp" | "telegram" | null>(null);

  const openChannel = async (channel: "whatsapp" | "telegram") => {
    setOpening(channel);
    try {
      const contact = await fetchContact(id, channel);
      const url = channel === "whatsapp" ? contact.whatsappUrl : contact.telegramUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast("Canal indisponível para este jogador.", "error");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao liberar o contato", "error");
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="-mx-4 -mt-6 flex min-h-[calc(100dvh-5rem)] flex-col items-center justify-center gap-6 bg-gradient-to-b from-primary-light to-primary px-6 py-12 text-center text-white md:rounded-card">
      {isLoading ? (
        <>
          <Skeleton className="size-24 rounded-full bg-white/30" />
          <Skeleton className="h-8 w-48 bg-white/30" />
        </>
      ) : isError || !data ? (
        <>
          <p className="text-lg font-bold">Match não encontrado</p>
          <Link href="/convites" className="underline">
            Voltar aos convites
          </Link>
        </>
      ) : (
        <>
          <div className="flex items-center" aria-hidden>
            <div className="rounded-full ring-4 ring-white">
              <Avatar name={data.me.displayName} photoUrl={data.me.photoUrl} size={88} />
            </div>
            <div className="-ml-5 rounded-full ring-4 ring-white">
              <Avatar name={data.partner.displayName} photoUrl={data.partner.photoUrl} size={88} />
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-extrabold">
              Deu match! <span aria-hidden>🎉</span>
            </h1>
            <p className="mt-2 text-sm text-white/90">
              Você e <strong>{data.partner.displayName}</strong> querem jogar{" "}
              <strong>{data.game.name}</strong>
            </p>
            {data.approxDistance && (
              <p className="mt-1 text-xs text-white/80">📍 {data.approxDistance}</p>
            )}
          </div>

          <div className="flex w-full max-w-xs flex-col gap-3">
            {data.channels.whatsapp && (
              <Button
                variant="whatsapp"
                full
                loading={opening === "whatsapp"}
                onClick={() => openChannel("whatsapp")}
              >
                💬 Conversar no WhatsApp
              </Button>
            )}
            {data.channels.telegram && (
              <Button
                variant="telegram"
                full
                loading={opening === "telegram"}
                onClick={() => openChannel("telegram")}
              >
                ✈️ Conversar no Telegram
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Link href="/home" className="text-sm font-semibold text-white underline">
              Voltar para a busca
            </Link>
            <p className="max-w-xs text-[11px] text-white/75">
              Combine o primeiro encontro em um lugar público, como uma luderia ou café. 🛡️
            </p>
          </div>
        </>
      )}
    </div>
  );
}
