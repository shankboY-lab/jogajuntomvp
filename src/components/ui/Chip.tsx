"use client";

/* eslint-disable @next/next/no-img-element */

// FE-01 — Chip de jogo (thumbnail + nome + remover) usado na coleção e nos
// jogos em comum (v2-03, v2-05, v2-06)

export function GameChip({
  name,
  thumbnailUrl,
  onClick,
  onRemove,
  active = false,
}: {
  name: string;
  thumbnailUrl?: string | null;
  onClick?: () => void;
  onRemove?: () => void;
  active?: boolean;
}) {
  const inner = (
    <>
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-md object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-md bg-cream-dark text-sm"
        >
          🎲
        </span>
      )}
      <span className="max-w-36 truncate text-sm font-medium">{name}</span>
    </>
  );

  return (
    <span
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border py-1.5 pl-2 ${
        onRemove ? "pr-1" : "pr-3.5"
      } ${active ? "border-primary bg-cream-dark text-primary-dark" : "border-line bg-white text-ink"}`}
    >
      {onClick ? (
        <button type="button" onClick={onClick} className="flex items-center gap-2">
          {inner}
        </button>
      ) : (
        inner
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remover ${name}`}
          className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-cream-dark hover:text-danger"
        >
          ✕
        </button>
      )}
    </span>
  );
}

export function TextChip({
  children,
  highlight = false,
}: {
  children: React.ReactNode;
  /** v3 — jogo em comum destacado com borda primary (modo C, v3-02) */
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        highlight
          ? "border border-primary bg-cream-dark text-primary-dark"
          : "bg-cream-dark text-primary-dark"
      }`}
    >
      {children}
    </span>
  );
}
