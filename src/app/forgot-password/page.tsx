"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { Field, InfoCallout, SubmitButton, linkClass } from "@/components/auth/fields";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    // The outcome is never shown, so the page can't be used to probe which emails have accounts.
    await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" }).catch(() => null);
    setLoading(false);
    setDone(true);
  }

  return (
    <AuthShell
      title="Redefina sua senha"
      subtitle="Enviaremos um link por e-mail para você escolher uma nova senha"
      footer={
        <Link href="/sign-in" className={linkClass}>
          Voltar para o login
        </Link>
      }
    >
      {done ? (
        <InfoCallout>Se existir uma conta para {email}, enviamos um link para redefinir sua senha.</InfoCallout>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <SubmitButton loading={loading} loadingLabel="Enviando...">
            Enviar link de redefinição
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
