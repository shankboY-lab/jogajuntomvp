// FE-01/RNF-03 — estado vazio padrão
export function EmptyState({
  icon = "🎲",
  title,
  description,
  children,
}: {
  icon?: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-white/60 px-6 py-10 text-center">
      <span aria-hidden className="text-4xl">
        {icon}
      </span>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-sm text-muted">{description}</p>}
      {children && <div className="mt-2 flex w-full flex-col gap-2">{children}</div>}
    </div>
  );
}
