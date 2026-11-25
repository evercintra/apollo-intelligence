"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, InfoCallout, SecondaryButton, SubmitButton, linkClass, quietLinkClass } from "@/components/auth/fields";
import { GoogleButton, OrDivider } from "@/components/auth/GoogleButton";

const ACCESS_REQUEST_TO = "pulkit@kandid.ai";

/** A mailto asking for an account on Apollo Intelligence Managed, carrying the email typed into the form when there is one. */
function accessRequestHref(email: string) {
  const body = [
    "Olá, Pulkit,",
    "",
    "Gostaria de usar a Apollo Intelligence gerenciada em vez de hospedá-la por conta própria. Você pode me enviar um convite?",
    "",
    `E-mail corporativo: ${email.trim()}`,
  ].join("\n");
  const subject = "Preciso de acesso à Apollo Intelligence gerenciada";
  return `mailto:${ACCESS_REQUEST_TO}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function SignInForm({
  googleEnabled,
  from,
  signupAvailable = true,
}: {
  googleEnabled: boolean;
  from: string | null;
  /** False on an invite-only instance: accounts come from invitations, so "Crie uma" is not offered. */
  signupAvailable?: boolean;
}) {
  const target = from || "/analytics";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setUnverified(false);
    setResent(false);
    setLoading(true);
    const { data, error: err } = await authClient.signIn.email({ email, password, callbackURL: target });
    if (!err) {
      // An AI assistant (OAuth) sign-in answers with the next step of that flow.
      const next = data as { redirect?: boolean; url?: unknown } | null;
      window.location.href = next?.redirect === true && typeof next.url === "string" ? next.url : target;
      return;
    }
    if (err.code === "EMAIL_NOT_VERIFIED") setUnverified(true);
    else if (err.code === "INVALID_EMAIL_OR_PASSWORD") setError("E-mail ou senha incorretos.");
    else setError(err.message || "Algo deu errado. Tente novamente.");
    setLoading(false);
  }

  async function resend() {
    setResending(true);
    const { error: err } = await authClient.sendVerificationEmail({ email, callbackURL: target });
    setResending(false);
    if (err) setError(err.message || "Não foi possível enviar o e-mail. Tente novamente.");
    else setResent(true);
  }

  const q = from ? `?from=${encodeURIComponent(from)}` : "";

  return (
    <AuthShell
      title="Entre na Apollo Intelligence"
      footer={
        signupAvailable ? (
          <>
            Não tem uma conta?{" "}
            <Link href={`/sign-up${q}`} className={linkClass}>
              Crie uma
            </Link>
          </>
        ) : (
          <>
            Precisa de acesso?{" "}
            <a href={accessRequestHref(email)} className={linkClass}>
              Peça um convite ao administrador
            </a>
          </>
        )
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5">
        <Field
          label="E-mail corporativo"
          type="email"
          autoComplete="email"
          placeholder="name@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Senha"
          labelAside={
            <Link href="/forgot-password" className={quietLinkClass}>
              Esqueceu a senha?
            </Link>
          }
          type="password"
          autoComplete="current-password"
          placeholder="Digite sua senha"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <ErrorCallout>{error}</ErrorCallout>}
        {unverified && (
          <div className="flex flex-col gap-3">
            <ErrorCallout>Seu e-mail ainda não foi verificado. Confira a caixa de entrada e abra o link de confirmação.</ErrorCallout>
            {resent ? (
              <InfoCallout>E-mail de verificação enviado. Pode levar alguns minutos para chegar.</InfoCallout>
            ) : (
              <SecondaryButton onClick={resend} loading={resending} disabled={!email}>
                Reenviar e-mail de verificação
              </SecondaryButton>
            )}
          </div>
        )}
        <div className="pt-1">
          <SubmitButton loading={loading} loadingLabel="Entrando...">
            Entrar
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
