"use client";

import { forwardRef } from "react";

// FE-01 — Button (primário/gradiente, secundário, outline, whatsapp, telegram)
// Touch targets >= 44px (RNF-11).

type Variant = "primary" | "secondary" | "outline" | "ghost" | "whatsapp" | "telegram" | "danger";

const styles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-primary-light to-primary text-white shadow-sm hover:from-primary hover:to-primary-dark",
  secondary: "bg-cream-dark text-primary-dark hover:bg-[#fce8db]",
  outline: "border border-primary text-primary bg-transparent hover:bg-cream-dark",
  ghost: "text-muted hover:text-ink bg-transparent",
  whatsapp: "bg-whatsapp text-white hover:bg-whatsapp-dark",
  telegram: "bg-telegram text-white hover:bg-telegram-dark",
  danger: "border border-danger text-danger bg-transparent hover:bg-red-50",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    loading = false,
    full = false,
    className = "",
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-input px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});
