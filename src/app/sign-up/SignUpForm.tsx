"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SecondaryButton, SubmitButton, linkClass } from "@/components/auth/fields";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";

export function SignUpForm({ googleEnabled, from, inviteOnly = false }: { googleEnabled: boolean; from: string | null; inviteOnly?: boolean }) {
  const target = from || "/analytics";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error: err } = await authClient.signUp.email({ name, email, password, callbackURL: target });
    setLoading(false);
    if (err) {
      setError(
        err.code === "USER_ALREADY_EXISTS" || err.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
          ? "Já existe uma conta com este e-mail. Tente entrar."
          : err.message || "Algo deu errado. Tente novamente.",
      );
      return;
    }
    setSent(true);
  }

  async function resend() {
    setResending(true);
    setError("");
    const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL: target });
    setResending(false);
    if (err) setError(err.message || "Não foi possível enviar o e-mail. Tente novamente.");
    else setResent(true);
  }

  const q = from ? `?from=${encodeURIComponent(from)}` : "";
  const footer = (
    <>
      Já tem uma conta?{" "}
      <Link href={`/sign-in${q}`} className={linkClass}>
        Entrar
      </Link>
    </>
  );

  if (sent) {
    return (
      <AuthShell title="Confira seu e-mail para confirmar o endereço" subtitle={`Enviamos um link de confirmação para ${email}. Abra-o para concluir a criação da sua conta.`} footer={footer}>
        <div className="flex flex-col gap-3">
          {inviteOnly && (
            <InfoCallout>
              Esta instância é somente por convite: se {email} não tiver sido convidado, nenhuma conta será criada e nenhum e-mail será enviado.
            </InfoCallout>
          )}
          {error && <ErrorCallout>{error}</ErrorCallout>}
          {resent ? (
            <InfoCallout>Enviado novamente. Pode levar alguns minutos para chegar.</InfoCallout>
          ) : (
            <SecondaryButton onClick={resend} loading={resending}>
              Reenviar e-mail de verificação
            </SecondaryButton>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Crie sua conta Apollo Intelligence" footer={footer}>
      {inviteOnly && (
        <div className="mb-5">
          <InfoCallout>Esta instância da Apollo Intelligence é somente por convite. Cadastre-se com o e-mail para o qual recebeu o convite.</InfoCallout>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field label="Nome" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="E-mail corporativo" type="email" autoComplete="email" placeholder="name@company.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field
          label="Senha"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          hint="Pelo menos 8 caracteres."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <div className="pt-1">
          <SubmitButton loading={loading} loadingLabel="Criando conta...">
            Criar conta
          </SubmitButton>
        </div>
      </form>
      {googleEnabled && (
        <>
          <OrDivider label="Ou continue com" />
          <GoogleButton callbackURL={target} onError={setError} label="Google" />
        </>
      )}
    </AuthShell>
  );
}
