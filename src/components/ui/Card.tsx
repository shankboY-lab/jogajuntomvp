export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-card border border-line bg-white p-4 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
