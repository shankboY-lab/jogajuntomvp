"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useInbox } from "@/lib/hooks";

// FE-01 — Bottom nav (Início / Matches com badge / Perfil). Em >=768px vira
// barra superior fixa (responsividade da doc §5.4).
const items = [
  { href: "/home", label: "Início", icon: "🏠" },
  { href: "/convites", label: "Matches", icon: "🤝" },
  { href: "/conta", label: "Perfil", icon: "👤" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { data: inbox } = useInbox();
  const badge = (inbox?.counts.received ?? 0) + 0;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur md:top-0 md:bottom-auto md:border-t-0 md:border-b"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around md:max-w-2xl">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const showBadge = item.href === "/convites" && badge > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                active ? "text-primary-dark" : "text-muted hover:text-ink"
              }`}
            >
              <span aria-hidden className="text-lg leading-none">
                {item.icon}
              </span>
              {item.label}
              {showBadge && (
                <span
                  aria-label={`${badge} convites pendentes`}
                  className="absolute top-2 right-1/2 flex size-4.5 -translate-x-[-14px] items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
