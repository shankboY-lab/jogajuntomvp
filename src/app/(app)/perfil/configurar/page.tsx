"use client";

// FE-06 — configurar/editar perfil (v2-03): foto, nome, localização (geo +
// fallback manual), raio, consent LGPD, jogos (via BGG), contato (>=1
// obrigatório — §8 Gaps). CTA habilitado só com o mínimo completo.
// A mesma tela serve como edição (RF-10) via /perfil/configurar?edit=1.

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { GameChip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { GameSearch } from "@/components/GameSearch";
import {
  useProfile,
  useCollection,
  useAddGame,
  useRemoveGame,
  useSaveProfile,
  geocodeForward,
  geocodeReverse,
} from "@/lib/hooks";
import { api } from "@/lib/api";
import { usePageView } from "@/lib/track";
import { RADIUS_OPTIONS } from "@/shared/schemas";
import type { GeocodeResult } from "@/shared/types";

function ProfileSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isEdit = searchParams.get("edit") === "1";
  const { update: updateSession } = useSession();
  const qc = useQueryClient();
  const { toast } = useToast();
  usePageView("perfil_configurar");

  const profileQuery = useProfile();
  const collectionQuery = useCollection();
  const addGame = useAddGame();
  const removeGame = useRemoveGame();
  const saveProfile = useSaveProfile();

  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<GeocodeResult | null>(null);
  const [manualLocation, setManualLocation] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(5);
  const [consent, setConsent] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  const [telegram, setTelegram] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // hidrata o formulário no modo edição
  useEffect(() => {
    const p = profileQuery.data;
    if (!p || hydrated) return;
    setHydrated(true);
    setDisplayName(p.displayName);
    setPhotoUrl(p.photoUrl);
    setRadiusKm(p.radiusKm);
    setWhatsapp(p.whatsapp ?? "");
    setTelegram(p.telegram ?? "");
    if (p.hasLocation) {
      setConsent(true);
      setLocation({
        city: p.city,
        neighborhood: p.neighborhood,
        // o backend nunca devolve coordenadas (RNF-07); um novo PUT sem mudar a
        // localização reusa as salvas via flag keepLocation abaixo
        lat: NaN,
        lng: NaN,
        label: p.neighborhood ? `${p.neighborhood}, ${p.city}` : p.city,
      });
    }
  }, [profileQuery.data, hydrated]);

  const collection = collectionQuery.data ?? [];

  const useMyLocation = () => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Seu navegador não suporta geolocalização — informe cidade/bairro.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { result } = await geocodeReverse(pos.coords.latitude, pos.coords.longitude);
          if (result) setLocation(result);
          else setLocationError("Não conseguimos identificar seu bairro — informe manualmente.");
        } catch {
          setLocationError("Erro ao resolver a localização — informe manualmente.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setLocationError("Permissão negada — informe cidade/bairro manualmente.");
      },
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const searchManualLocation = async () => {
    if (manualLocation.trim().length < 3) return;
    setLocationError(null);
    setLocating(true);
    try {
      const { result } = await geocodeForward(manualLocation);
      if (result) setLocation(result);
      else setLocationError("Local não encontrado — tente “bairro, cidade”.");
    } catch {
      setLocationError("Erro ao buscar o local. Tente novamente.");
    } finally {
      setLocating(false);
    }
  };

  const onPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast("A foto precisa ter no máximo 2 MB.", "error");
      return;
    }
    setUploadingPhoto(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { url } = await api<{ url: string }>("/api/profile/photo", {
        method: "POST",
        body: form,
      });
      setPhotoUrl(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro no upload da foto", "error");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const hasContact = whatsapp.trim().length > 0 || telegram.trim().length > 0;
  const hasLocation = location !== null;
  const canSubmit =
    displayName.trim().length >= 2 &&
    hasLocation &&
    consent &&
    hasContact &&
    collection.length >= 1;

  const progress = useMemo(() => {
    let done = 0;
    if (displayName.trim().length >= 2) done++;
    if (hasLocation && consent) done++;
    if (collection.length >= 1) done++;
    if (hasContact) done++;
    return done;
  }, [displayName, hasLocation, consent, collection.length, hasContact]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !location) return;
    try {
      const body = {
        displayName: displayName.trim(),
        photoUrl,
        city: location.city,
        neighborhood: location.neighborhood,
        // NaN = edição sem alterar localização → envia null e o backend
        // mantém as coordenadas salvas (RNF-07)
        lat: Number.isNaN(location.lat) ? null : location.lat,
        lng: Number.isNaN(location.lng) ? null : location.lng,
        radiusKm: radiusKm as 2 | 5 | 10 | 25,
        whatsapp: whatsapp.trim() || null,
        telegram: telegram.trim() || null,
        locationConsent: consent,
      };
      await saveProfile.mutateAsync(body);
      await updateSession(); // reflete profileComplete no JWT (BE-04/FE-05)
      await qc.invalidateQueries();
      toast(isEdit ? "Perfil atualizado!" : "Perfil completo — bora jogar!", "success");
      router.push(isEdit ? "/conta" : "/home");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Erro ao salvar o perfil", "error");
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 pb-8">
      <header>
        <h1 className="text-2xl font-extrabold">
          {isEdit ? "Editar perfil" : "Configure seu perfil"}
        </h1>
        <div
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={4}
          aria-label="Progresso do perfil"
          className="mt-3 h-2 overflow-hidden rounded-full bg-cream-dark"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-light to-primary transition-all"
            style={{ width: `${(progress / 4) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted">{progress} de 4 etapas completas</p>
      </header>

      {/* Foto (opcional) + nome */}
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={displayName || "?"} photoUrl={photoUrl} size={64} />
          <label className="cursor-pointer text-sm font-semibold text-primary-dark hover:underline">
            {uploadingPhoto ? "Enviando…" : photoUrl ? "Trocar foto" : "Adicionar foto (opcional)"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onPhotoChange}
              disabled={uploadingPhoto}
            />
          </label>
        </div>
        <Input
          label="Nome ou apelido"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Como quer ser chamado(a)?"
          maxLength={40}
          required
        />
      </Card>

      {/* Localização e raio */}
      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Localização e raio</h2>
        {location ? (
          <div className="flex items-center justify-between rounded-input bg-cream-dark px-4 py-3">
            <span className="text-sm font-semibold">📍 {location.label}</span>
            <button
              type="button"
              onClick={() => setLocation(null)}
              className="text-xs font-semibold text-primary-dark hover:underline"
            >
              alterar
            </button>
          </div>
        ) : (
          <>
            <Button
              type="button"
              variant="secondary"
              full
              loading={locating}
              onClick={useMyLocation}
            >
              📍 Usar minha localização
            </Button>
            <div className="flex gap-2">
              <Input
                aria-label="Cidade ou bairro"
                value={manualLocation}
                onChange={(e) => setManualLocation(e.target.value)}
                placeholder="Ou digite: bairro, cidade"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchManualLocation();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchManualLocation}
                loading={locating}
              >
                Buscar
              </Button>
            </div>
          </>
        )}
        {locationError && <p className="text-xs font-medium text-danger">{locationError}</p>}

        <div>
          <label htmlFor="radius" className="text-xs font-bold uppercase tracking-wide text-muted">
            Raio de busca
          </label>
          <select
            id="radius"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="mt-1.5 min-h-11 w-full rounded-input border border-line bg-white px-4 text-sm"
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r} km
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 size-5 accent-primary"
            required
          />
          <span>
            Concordo em usar minha localização para encontrar jogadores.{" "}
            <strong>Mostramos só a distância aproximada — nunca seu endereço.</strong>
          </span>
        </label>
      </Card>

      {/* Jogos que possuo */}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Jogos que possuo</h2>
          <span className="rounded-full bg-cream-dark px-2 py-0.5 text-[10px] font-bold text-primary-dark">
            via BoardGameGeek
          </span>
        </div>
        <GameSearch
          mode="collect"
          disabledIds={collection.map((g) => g.bggId)}
          onConfirm={async (game) => {
            try {
              await addGame.mutateAsync(game.bggId);
              toast(`${game.name} adicionado à coleção!`, "success");
            } catch (err) {
              toast(err instanceof Error ? err.message : "Erro ao adicionar jogo", "error");
            }
          }}
        />
        {collection.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {collection.map((g) => (
              <GameChip
                key={g.bggId}
                name={g.name}
                thumbnailUrl={g.thumbnailUrl}
                onRemove={() => removeGame.mutate(g.bggId)}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted">Adicione ao menos 1 jogo para completar o perfil.</p>
        )}
      </Card>

      {/* Contato — §8 Gaps: necessário para RF-25, ausente no Figma */}
      <Card className="flex flex-col gap-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Contato</h2>
        <p className="text-xs text-muted">
          Informe ao menos um — é ele que o outro jogador vê <strong>depois do match</strong>.
        </p>
        <Input
          label="WhatsApp"
          type="tel"
          inputMode="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          placeholder="(11) 99999-9999"
        />
        <Input
          label="Telegram"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
          placeholder="@seuusername"
        />
      </Card>

      <Button type="submit" full disabled={!canSubmit} loading={saveProfile.isPending}>
        {isEdit ? "Salvar alterações" : "Salvar e ir para a home"}
      </Button>
      {!canSubmit && (
        <p className="text-center text-xs text-muted">
          Complete nome, localização + consentimento, 1 jogo e 1 contato para continuar.
        </p>
      )}
    </form>
  );
}

export default function ProfileSetupPage() {
  return (
    <Suspense>
      <ProfileSetupForm />
    </Suspense>
  );
}
