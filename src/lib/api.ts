// FE-02 — client HTTP tipado com tratamento padrão de erro e de 401

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    window.location.href = "/login";
    throw new ApiClientError(401, "unauthorized", "Sessão expirada");
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // respostas sem corpo
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? "unknown_error",
      err?.message ?? "Algo deu errado. Tente novamente.",
      body as Record<string, unknown>,
    );
  }

  return body as T;
}
