export function Logo({ size = "lg" }: { size?: "sm" | "lg" }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span aria-hidden className={size === "lg" ? "text-5xl" : "text-3xl"}>
        🎲
      </span>
      <span
        className={`font-extrabold tracking-tight text-primary-dark ${size === "lg" ? "text-3xl" : "text-xl"}`}
      >
        JogaJunto
      </span>
      {size === "lg" && (
        <p className="text-sm text-muted">Encontre quem quer jogar perto de você</p>
      )}
    </div>
  );
}
