"use client";

import { useState } from "react";

export default function UnsubscribeClient({ token }: { token: string | null }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUnsubscribe() {
    if (!token) return;
    setState("loading");
    try {
      const res = await fetch("/api/outreach/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Algo deu errado");
        setState("error");
        return;
      }
      setEmail(data.email);
      setState("done");
    } catch {
      setError("Erro de rede — tente novamente");
      setState("error");
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-lg font-bold text-text-strong-950">Link inválido</h1>
        <p className="text-sm text-text-strong-950/50 mt-2">Este link de cancelamento está sem o token.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-success-lighter flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-success-base" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-text-strong-950">Inscrição cancelada</h1>
        <p className="text-sm text-text-strong-950/50 mt-2">
          {email} não receberá mais e-mails nossos.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <h1 className="text-lg font-bold text-text-strong-950">Cancelar inscrição</h1>
      <p className="text-sm text-text-strong-950/50 mt-2 mb-6">
        Clique abaixo para parar de receber e-mails deste remetente.
      </p>
      {error && <p className="text-xs text-error-base bg-error-lighter rounded-lg px-3 py-2 mb-4">{error}</p>}
      <button
        onClick={handleUnsubscribe}
        disabled={state === "loading"}
        className="w-full h-10 rounded-lg bg-accent-base text-accent-contrast text-sm font-medium hover:bg-accent-hover disabled:opacity-50 transition-colors"
      >
        {state === "loading" ? "Cancelando…" : "Cancelar inscrição"}
      </button>
    </div>
  );
}
