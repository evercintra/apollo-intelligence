"use client";

import { use, useEffect, useState } from "react";
import { authClient, useSession } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, SecondaryButton, linkClass } from "@/components/auth/fields";
import { Spinner } from "@/components/auth/fields";
import Link from "next/link";

type Invitation = {
  id: string;
  organizationName: string;
  inviterEmail: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date | string;
  organizationId: string;
};

export default function AcceptInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, isPending } = useSession();
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "wrong-email">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [declined, setDeclined] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (isPending) return;
    let cancelled = false;
    authClient.organization.getInvitation({ query: { id } }).then(({ data, error: err }) => {
      if (cancelled) return;
      if (err || !data) {
        // Signed out, a stranger's invitation, or gone: the API answers the same for all.
        setState(session ? (err?.status === 403 ? "wrong-email" : "missing") : "ready");
        return;
      }
      const inv = data as Invitation;
      setInvite(inv);
      setExpired(inv.status !== "pending" || new Date(inv.expiresAt).getTime() < Date.now());
      setState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [id, isPending, session]);

  const from = encodeURIComponent(`/accept-invitation/${id}`);

  async function accept() {
    setError("");
    setBusy("accept");
    const res = await authClient.organization.acceptInvitation({ invitationId: id });
    if (res.error) {
      setError(res.error.message || "Não foi possível aceitar o convite.");
      return setBusy(null);
    }
    const organizationId = res.data?.invitation?.organizationId ?? invite?.organizationId;
    if (organizationId) {
      const active = await authClient.organization.setActive({ organizationId });
      if (active.error) {
        setError(active.error.message || "Você entrou, mas não foi possível acessar a organização.");
        return setBusy(null);
      }
    }
    window.location.href = "/analytics";
  }

  async function decline() {
    setError("");
    setBusy("decline");
    const { error: err } = await authClient.organization.rejectInvitation({ invitationId: id });
    setBusy(null);
    if (err) setError(err.message || "Não foi possível recusar o convite.");
    else setDeclined(true);
  }

  if (state === "loading" || isPending) {
    return (
      <AuthShell title="Carregando convite">
        <div className="flex justify-center text-apollo-purple-300">
          <Spinner />
        </div>
      </AuthShell>
    );
  }

  if (declined) {
    return (
      <AuthShell title="Convite recusado" subtitle="Você não será adicionado a esta organização.">
        <Link href="/" className={linkClass}>
          Ir para a Apollo Intelligence
        </Link>
      </AuthShell>
    );
  }

  if (state === "wrong-email") {
    return (
      <AuthShell title="Conta incorreta" subtitle="Este convite foi enviado para outro endereço de e-mail. Entre com o e-mail convidado para aceitá-lo.">
        <Link href={`/sign-in?from=${from}`} className={linkClass}>
          Trocar de conta
        </Link>
      </AuthShell>
    );
  }

  if (state === "missing" || expired) {
    return (
      <AuthShell
        title={expired ? "Convite expirado" : "Convite não encontrado"}
        subtitle={expired ? "Este convite não é mais válido. Peça a quem o enviou para mandar um novo." : "Este link é inválido, já foi usado ou foi enviado para outro endereço de e-mail."}
      >
        <Link href="/sign-in" className={linkClass}>
          Voltar para o login
        </Link>
      </AuthShell>
    );
  }

  const who = invite ? `${invite.inviterEmail} convidou você para entrar em ${invite.organizationName}.` : "Você foi convidado a entrar em uma organização.";

  if (!session) {
    return (
      <AuthShell title="Você foi convidado" subtitle={`${who} Entre ou crie uma conta para aceitar.`}>
        <div className="flex flex-col gap-3">
          <Link href={`/sign-in?from=${from}`} className="w-full rounded-lg bg-apollo-lime-400 py-3 text-center text-sm font-semibold text-apollo-graphite-900 transition-colors hover:bg-apollo-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-apollo-graphite-950">
            Entrar para aceitar
          </Link>
          <Link href={`/sign-up?from=${from}`} className="w-full rounded-lg border border-apollo-purple-300/25 bg-apollo-graphite-900/60 py-3 text-center text-sm font-semibold text-apollo-soft-white transition-colors hover:border-apollo-purple-300/40 hover:bg-apollo-graphite-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/50">
            Criar conta
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Você foi convidado" subtitle={who}>
      <div className="flex flex-col gap-3">
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <button
          type="button"
          onClick={accept}
          disabled={!!busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-apollo-lime-400 py-3 text-sm font-semibold text-apollo-graphite-900 shadow-lg shadow-apollo-lime-400/10 transition-colors hover:bg-apollo-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy === "accept" && <Spinner />}
          Aceitar
        </button>
        <SecondaryButton onClick={decline} loading={busy === "decline"} disabled={!!busy}>
          Recusar
        </SecondaryButton>
      </div>
    </AuthShell>
  );
}
