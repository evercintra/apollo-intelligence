"use client";

import { useState, type FormEvent } from "react";
import * as Button from "@/components/alignui/button";
import * as Checkbox from "@/components/alignui/checkbox";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import type { ApiKeySummary } from "@/lib/publicApi/keys";
import { ALL_API_SCOPES, type ApiScope } from "@/lib/publicApi/scopes";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

const SCOPE_COPY_PT: Record<ApiScope, { label: string; description: string }> = {
  "crm:read": {
    label: "Ler o CRM",
    description: "Ver a fila de Ação necessária e os registros de leads: conversas, detalhes e ligações.",
  },
  "crm:write": {
    label: "Trabalhar no CRM",
    description: "Editar e reescrever rascunhos, alterar estágios, adiar ou fechar registros e marcar leads como Não contatar.",
  },
  "crm:send": {
    label: "Enviar mensagens",
    description: "Enviar respostas aos leads por e-mail, LinkedIn ou WhatsApp em seu nome.",
  },
  "campaigns:read": {
    label: "Ler campanhas",
    description: "Listar campanhas de e-mail.",
  },
  "campaigns:write": {
    label: "Gerenciar leads das campanhas",
    description: "Adicionar leads a campanhas de e-mail e interromper suas sequências.",
  },
};

function when(iso: string | null): string {
  return iso ? dateFormat.format(new Date(iso)) : "Nunca";
}

/**
 * Settings → API keys: create, copy once, revoke. The key itself is only in
 * the create response, so it is shown until the person dismisses it and
 * never again (src/lib/publicApi/keys.ts).
 */
export function ApiKeysSettings({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
  const dialogs = useDialogs();
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<Set<ApiScope>>(() => new Set(ALL_API_SCOPES));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy("create");
    setError("");
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: ALL_API_SCOPES.filter((scope) => scopes.has(scope)) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error || "Não foi possível criar a chave.");
      setKeys((current) => [data.apiKey as ApiKeySummary, ...current]);
      setCreated({ key: data.key as string, name: (data.apiKey as ApiKeySummary).name });
      setCopied(false);
      setName("");
    } catch {
      setError("Erro de rede. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  async function revoke(key: ApiKeySummary) {
    const confirmed = await dialogs.confirm({
      title: `Revogar ${key.name}?`,
      description: "Tudo que usa esta chave para de funcionar imediatamente. Isso não pode ser desfeito.",
      confirmLabel: "Revogar chave",
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(`revoke-${key.id}`);
    setError("");
    try {
      const res = await fetch(`/api/settings/api-keys/${key.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) return setError(data?.error || "Não foi possível revogar a chave.");
      const now = new Date().toISOString();
      setKeys((current) => current.map((k) => (k.id === key.id ? { ...k, revokedAt: k.revokedAt ?? now } : k)));
    } catch {
      setError("Erro de rede. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.key);
      setCopied(true);
    } catch {
      setError("Não foi possível copiar. Selecione a chave e copie manualmente.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Callout tone="info">
        Uma chave age pela organização inteira, limitada ao que você marcar ao criá-la. Envie-a como{" "}
        <code>Authorization: Bearer &lt;key&gt;</code> para <code>/api/v1/</code>, ou use-a para conectar um assistente de IA
        a <code>/api/mcp</code> sem login (Configurações → Assistentes de IA).
      </Callout>
      {error && <Callout tone="error">{error}</Callout>}

      {created && (
        <Callout
          tone="success"
          title={`Copie a chave de ${created.name} agora`}
          action={
            <Button.Root variant="neutral" mode="ghost" size="xsmall" onClick={() => setCreated(null)}>
              Concluído
            </Button.Root>
          }
        >
          <p>Ela aparece só uma vez. Guarde nas configurações do outro aplicativo.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 break-all rounded-lg bg-bg-white-0 px-2.5 py-1.5 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
              {created.key}
            </code>
            <Button.Root variant="primary" mode="filled" size="xsmall" onClick={() => void copy()}>
              {copied ? "Copiado" : "Copiar"}
            </Button.Root>
          </div>
        </Callout>
      )}

      <Frame>
        <FrameHeader title="Criar uma chave" description="Use um nome que identifique quem vai utilizá-la, por exemplo o nome do aplicativo." />
        <FramePanel>
          <form onSubmit={create} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input
                  aria-label="Nome da chave"
                  placeholder="Nome da chave"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Input.Wrapper>
            </Input.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy === "create" || !name.trim() || scopes.size === 0}>
              {busy === "create" ? "Criando…" : "Criar chave"}
            </Button.Root>
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-label-xs text-text-sub-600">O que a chave pode fazer</legend>
              {ALL_API_SCOPES.map((scope) => (
                <label key={scope} className="flex cursor-pointer items-start gap-2.5">
                  <Checkbox.Root
                    className="mt-0.5"
                    checked={scopes.has(scope)}
                    onCheckedChange={(checked) => setScopes((current) => {
                      const next = new Set(current);
                      if (checked === true) next.add(scope);
                      else next.delete(scope);
                      return next;
                    })}
                  />
                  <span className="min-w-0">
                    <span className="block text-label-sm text-text-strong-950">
                      {SCOPE_COPY_PT[scope].label} <code className="text-paragraph-xs text-text-sub-600">{scope}</code>
                    </span>
                    <span className="block text-paragraph-xs text-text-sub-600">{SCOPE_COPY_PT[scope].description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </form>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Chaves" description={`${keys.filter((k) => !k.revokedAt).length} ${keys.filter((k) => !k.revokedAt).length === 1 ? "ativa" : "ativas"}`} />
        <FramePanel>
          {keys.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">Ainda não há chaves.</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-label-sm text-text-strong-950">
                      {key.name}
                      {key.revokedAt && <span className="ml-2 text-paragraph-xs text-text-sub-600">Revogada</span>}
                    </p>
                    <p className="text-paragraph-xs text-text-sub-600">
                      <code>{key.keyPrefix}…</code> · Criada em {when(key.createdAt)} · Último uso {when(key.lastUsedAt)}
                    </p>
                    <p className="text-paragraph-xs text-text-sub-600">
                      {key.scopes.length === ALL_API_SCOPES.length
                        ? "Acesso completo"
                        : key.scopes.map((scope) => SCOPE_COPY_PT[scope].label).join(" · ") || "Sem acesso"}
                    </p>
                  </div>
                  {!key.revokedAt && (
                    <Button.Root
                      variant="error"
                      mode="ghost"
                      size="xsmall"
                      disabled={busy === `revoke-${key.id}`}
                      onClick={() => void revoke(key)}
                    >
                      Revogar
                    </Button.Root>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
