"use client";

import { useId } from "react";

// FE-01 — Tabs acessíveis (v2-07): setas navegam, aria-selected (RNF-11)
export interface TabDef {
  key: string;
  label: string;
  badge?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
}) {
  const baseId = useId();

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = tabs.findIndex((t) => t.key === active);
    if (e.key === "ArrowRight") onChange(tabs[(idx + 1) % tabs.length].key);
    if (e.key === "ArrowLeft") onChange(tabs[(idx - 1 + tabs.length) % tabs.length].key);
  };

  return (
    <div
      role="tablist"
      aria-label="Seções"
      onKeyDown={onKeyDown}
      className="flex gap-1 rounded-input bg-cream-dark p-1"
    >
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            role="tab"
            id={`${baseId}-${tab.key}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.key)}
            className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-2 text-sm font-semibold transition-colors ${
              selected ? "bg-white text-primary-dark shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {tab.badge > 9 ? "9+" : tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
