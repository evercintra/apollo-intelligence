"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, SecondaryButton } from "@/components/auth/fields";
import { useOAuthClient } from "@/components/oauth/useOAuthClient";
import { API_SCOPES, MCP_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";

/** crm:read is what a connection is for; the others the person may withhold. */
const REQUIRED_SCOPE: ApiScope = "crm:read";

export function ConsentForm({
  clientId,
  returnsTo,
  requestedScope,
  userName,
  userEmail,
  organizationName,
}: {
  clientId: string | null;
  /** Host the browser returns to after Allow — names, unlike hosts, can be claimed by anyone. */
  returnsTo: string | null;
  /** The `scope` the client asked for, space-separated. */
  requestedScope: string;
  userName: string;
  userEmail: string;
  organizationName: string;
}) {
  const client = useOAuthClient(clientId);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [error, setError] = useState("");
  const appName = client.name ?? "Um assistente de IA";
  const requested = requestedScope.split(/\s+/).filter(Boolean);
  const offered = MCP_SCOPES.filter((scope) => requested.includes(scope));
  const [granted, setGranted] = useState<Set<ApiScope>>(() => new Set(offered));
  const toggle = (scope: ApiScope) =>
    setGranted((current) => {
      const next = new Set(current);
      if (next.has(scope)) next.delete(scope);
      else next.add(scope);
      return next;
    });

  async function answer(accept: boolean) {
    setPending(accept ? "allow" : "deny");
    setError("");
    // Identity scopes (openid, offline_access, …) pass through; Apollo Intelligence's are as ticked.
    const scope = requested.filter((value) => !(MCP_SCOPES as readonly string[]).includes(value) || granted.has(value as ApiScope)).join(" ");
    const { data, error: err } = await authClient.oauth2.consent(accept ? { accept, scope } : { accept });
    const next = data as { redirect?: boolean; url?: unknown } | null;
    if (err || !next || typeof next.url !== "string") {
      setError(err?.message || "Algo deu errado. Tente novamente.");
      setPending(null);
      return;
    }
    window.location.href = next.url;
  }

  return (
    <AuthShell title={`${appName} quer se conectar à Apollo Intelligence`}>
      <div className="flex flex-col gap-5">
        {client.logo && (
          // eslint-disable-next-line @next/next/no-img-element -- a third party's logo, arbitrary host
          <img src={client.logo} alt="" className="mx-auto -mt-3 size-12 rounded-xl object-cover" />
        )}
        <dl className="rounded-lg border border-apollo-purple-300/20 bg-apollo-graphite-900/60 px-4 py-3 text-sm">
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-apollo-purple-300">Conectado como</dt>
            <dd className="min-w-0 truncate text-right text-apollo-soft-white">{userName || userEmail}</dd>
          </div>
          <div className="flex justify-between gap-4 py-1">
            <dt className="text-apollo-purple-300">Organização</dt>
            <dd className="min-w-0 truncate text-right text-apollo-soft-white">{organizationName}</dd>
          </div>
          {returnsTo && (
            <div className="flex justify-between gap-4 py-1">
              <dt className="text-apollo-purple-300">Retorna para</dt>
              <dd className="min-w-0 truncate text-right font-mono text-xs leading-5 text-apollo-soft-white">{returnsTo}</dd>
            </div>
          )}
        </dl>
        <div>
          <p className="text-sm font-medium text-apollo-soft-white">Ele poderá:</p>
          {offered.length === 0 ? (
            <p className="mt-2 text-sm text-apollo-purple-200">Apenas ver quem você é — não solicitou acesso aos dados da Apollo Intelligence.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {offered.map((scope) => {
                const required = scope === REQUIRED_SCOPE;
                return (
                  <li key={scope}>
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-apollo-purple-300/20 px-3 py-2.5 transition-colors hover:border-apollo-purple-300/40 has-[:disabled]:cursor-default focus-within:border-apollo-lime-400/50">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 accent-apollo-lime-400"
                        checked={required || granted.has(scope)}
                        disabled={required || pending !== null}
                        onChange={() => toggle(scope)}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-apollo-soft-white">
                          {API_SCOPES[scope].label}
                          {required && <span className="ml-1.5 text-xs text-apollo-graphite-400">obrigatório</span>}
                        </span>
                        <span className="block text-xs text-apollo-purple-300">{API_SCOPES[scope].description}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs leading-relaxed text-apollo-purple-300">
            Permita isso somente se você mesmo iniciou a conexão com {appName} agora.{" "}
            Todas as ações são registradas na linha do tempo do CRM como {userName || userEmail} via assistente de IA. Você pode desconectar a
            qualquer momento em Configurações → Assistentes de IA.
          </p>
        </div>
        {error && <ErrorCallout>{error}</ErrorCallout>}
        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            onClick={() => void answer(true)}
            disabled={pending !== null}
            className="h-11 w-full rounded-lg bg-apollo-lime-400 text-sm font-semibold text-apollo-graphite-900 transition-colors hover:bg-apollo-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/60 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === "allow" ? "Conectando..." : "Permitir"}
          </button>
          <SecondaryButton onClick={() => void answer(false)} disabled={pending !== null} loading={pending === "deny"}>
            Cancelar
          </SecondaryButton>
        </div>
      </div>
    </AuthShell>
  );
}
