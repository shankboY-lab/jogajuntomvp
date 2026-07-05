"use client";

import { forwardRef, useId, useState } from "react";

// FE-01 — Input com label maiúscula pequena + estado de erro (padrão do Figma)

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string | null;
  hint?: string;
  /** mostra o toggle de visibilidade (telas v2-01/v2-02) */
  passwordToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, passwordToggle, className = "", id, type, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [visible, setVisible] = useState(false);
  const actualType = passwordToggle ? (visible ? "text" : "password") : type;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-xs font-bold uppercase tracking-wide text-muted">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={actualType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={`min-h-11 w-full rounded-input border bg-white px-4 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-primary focus:outline-none ${
            error ? "border-danger" : "border-line"
          } ${passwordToggle ? "pr-12" : ""} ${className}`}
          {...rest}
        />
        {passwordToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-ink"
          >
            {visible ? "🙈" : "👁️"}
          </button>
        )}
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${inputId}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
