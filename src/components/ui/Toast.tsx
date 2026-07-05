"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

// FE-01 — Toast com aria-live (RNF-11)

interface ToastItem {
  id: number;
  message: string;
  kind: "info" | "error" | "success";
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastItem["kind"]) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((message: string, kind: ToastItem["kind"] = "info") => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-24 z-50 flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-md rounded-card px-4 py-3 text-sm font-medium text-white shadow-lg ${
              t.kind === "error"
                ? "bg-danger"
                : t.kind === "success"
                  ? "bg-whatsapp-dark"
                  : "bg-ink"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
