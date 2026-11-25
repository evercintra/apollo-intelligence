"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SubmitButton, linkClass } from "@/components/auth/fields";

export function ResetPasswordForm({ token, invalid }: { token: string | null; invalid: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("A senha deve ter pelo menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    if (!token) return;
    setLoading(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (err) setError(err.code === "INVALID_TOKEN" ? "Este link de redefinição é inválido ou expirou." : err.message || "Algo deu errado. Tente novamente.");
    else setDone(true);
  }

  if (invalid) {
    return (
      <AuthShell title="Link expirado" subtitle="Este link de redefinição de senha é inválido ou expirou.">
        <Link href="/forgot-password" className={linkClass}>
          Solicitar um novo link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Escolha uma nova senha">
      {done ? (
        <div className="flex flex-col gap-3">
          <InfoCallout>Sua senha foi atualizada.</InfoCallout>
          <Link href="/sign-in" className={linkClass}>
            Continuar para o login
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Nova senha" type="password" autoComplete="new-password" minLength={8} required hint="Pelo menos 8 caracteres." value={password} onChange={(e) => setPassword(e.target.value)} />
          <Field label="Confirmar senha" type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <SubmitButton loading={loading} loadingLabel="Salvando...">
            Atualizar senha
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
