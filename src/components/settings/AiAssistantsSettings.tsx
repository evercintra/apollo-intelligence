"use client";

import { useCallback, useEffect, useState } from "react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout } from "@/components/settings/SettingsKit";
import { cn } from "@/utils/cn";

type Connection = {
  clientId: string;
  name: string | null;
  uri: string | null;
  icon: string | null;
  connectedAt: string | null;
  lastActiveAt: string | null;
};

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

function relative(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button.Root
      variant="neutral"
      mode="stroke"
      size="xsmall"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copiado" : label}
    </Button.Root>
  );
}

function CodeBlock({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
        <code>{text}</code>
      </pre>
      <CopyButton text={text} />
    </div>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-paragraph-sm text-text-sub-600">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-weak-50 text-label-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">{item}</div>
        </li>
      ))}
    </ol>
  );
}

const TABS = [
  { id: "claude", label: "Claude (web e desktop)" },
  { id: "code", label: "Claude Code" },
  { id: "other", label: "Outros clientes" },
] as const;

const PROMPTS = [
  "Resuma minha fila de Ação necessária",
  "Crie respostas para todos que pediram preços — me mostre antes de enviar",
  "Encontre Priya da Acme e me diga como está o negócio",
  "Marque os leads que disseram ‘agora não’ para acompanhar no mês que vem",
];

export function AiAssistantsSettings({ serverUrl }: { serverUrl: string }) {
  const dialogs = useDialogs();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("claude");
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/ai-assistants", { credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Não foi possível carregar suas conexões.");
      setConnections((data?.connections ?? []) as Connection[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar suas conexões.");
      setConnections((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  async function disconnect(c: Connection) {
    const name = c.name || "este assistente";
    const confirmed = await dialogs.confirm({
      title: `Desconectar ${name}?`,
      description: "Ele para de funcionar imediatamente. Você pode conectá-lo de novo quando quiser.",
      confirmLabel: "Desconectar",
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(c.clientId);
    setError("");
    try {
      const res = await fetch("/api/settings/ai-assistants", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: c.clientId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) setError(data?.error || "Não foi possível desconectar.");
      else await load();
    } catch {
      setError("Erro de rede. Tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  const mcpJson = JSON.stringify(
    { mcpServers: { agentsdr: { type: "http", url: serverUrl, headers: { Authorization: "Bearer ${AGENTSDR_API_KEY}" } } } },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title="Suas conexões" description="Assistentes que podem trabalhar nesta organização por você." />
        <FramePanel>
          {error && <Callout tone="error" className="mb-3">{error}</Callout>}
          {connections === null ? (
            <p className="text-paragraph-sm text-text-sub-600">Carregando…</p>
          ) : connections.length === 0 ? (
            <p className="text-paragraph-sm text-text-sub-600">Ainda não há assistentes conectados.</p>
          ) : (
            <ul className="divide-y divide-stroke-soft-200">
              {connections.map((c) => (
                <li key={c.clientId} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    {c.icon && (
                      // eslint-disable-next-line @next/next/no-img-element -- a third party's logo, arbitrary host
                      <img src={c.icon} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{c.name || "Assistente de IA"}</p>
                      <p className="text-paragraph-xs text-text-sub-600">
                        Conectado em {c.connectedAt ? dateFormat.format(new Date(c.connectedAt)) : "data anterior"} · Última atividade{" "}
                        {relative(c.lastActiveAt)}
                      </p>
                    </div>
                  </div>
                  <Button.Root variant="error" mode="ghost" size="xsmall" disabled={busy === c.clientId} onClick={() => void disconnect(c)}>
                    {busy === c.clientId ? "Desconectando…" : "Desconectar"}
                  </Button.Root>
                </li>
              ))}
            </ul>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="URL do servidor" description="Cole isto no Claude, ChatGPT ou em qualquer cliente MCP para conectar." />
        <FramePanel>
          <div className="flex items-center gap-2">
            <Input.Root size="small" className="flex-1">
              <Input.Wrapper>
                <Input.Input aria-label="URL do servidor MCP" readOnly value={serverUrl} onFocus={(e) => e.currentTarget.select()} />
              </Input.Wrapper>
            </Input.Root>
            <CopyButton text={serverUrl} />
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Como conectar" description="Escolha o app que você usa. Cada um leva cerca de um minuto." />
        <FramePanel>
          <div role="tablist" className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-label-sm ring-1 ring-inset transition-colors",
                  tab === t.id
                    ? "bg-bg-strong-950 text-text-white-0 ring-transparent"
                    : "bg-bg-white-0 text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-weak-50",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "claude" && (
            <div className="flex flex-col gap-4">
              <Steps
                items={[
                  <>Abra o Claude e vá em <b>Customize → Connectors</b> (também acessível em Settings).</>,
                  <>Escolha <b>Add → Add custom connector</b>. Nomeie como <b>Apollo</b>, cole a URL do servidor acima e escolha <b>Continue</b>.</>,
                  <>Depois que o Claude verificar o servidor, escolha <b>Add</b> e então <b>Connect</b>.</>,
                  <>Se pedido, entre no Apollo, confira a organização e escolha <b>Allow</b>.</>,
                  <>Em uma conversa, ative o Apollo no menu de ferramentas e pergunte, por exemplo: &ldquo;O que há na minha fila de Ação necessária?&rdquo;</>,
                ]}
              />
              <Callout tone="info">
                Nos planos Claude Team e Enterprise, um proprietário precisa adicionar o conector nas configurações da organização
                antes de os membros conectarem.
              </Callout>
            </div>
          )}

          {tab === "code" && (
            <Steps
              items={[
                <div key="a" className="flex flex-col gap-2">
                  <span>Execute isto no seu terminal:</span>
                  <CodeBlock text={`claude mcp add --transport http agentsdr ${serverUrl}`} />
                </div>,
                <>Inicie o Claude Code e execute <code>/mcp</code>.</>,
                <>Selecione <b>agentsdr</b>, escolha <b>Authenticate</b> e seu navegador abrirá.</>,
                <>Se pedido, entre no Apollo e escolha <b>Allow</b>.</>,
              ]}
            />
          )}

          {tab === "other" && (
            <div className="flex flex-col gap-4 text-paragraph-sm text-text-sub-600">
              <p>
                Qualquer cliente com suporte a MCP remoto via Streamable HTTP com OAuth funciona com a mesma URL, incluindo
                ChatGPT (adicione o Apollo como app personalizado nas configurações), Cursor e outros editores.
              </p>
              <p>
                Para uma configuração sem navegador, um proprietário ou administrador pode criar uma chave de API em <b>Configurações → Chaves de API</b> e
                enviá-la como <code>Authorization: Bearer asdr_…</code>. A chave representa a organização inteira, não uma
                pessoa.
              </p>
              <CodeBlock text={mcpJson} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="Sugestões de perguntas" />
        <FramePanel>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-paragraph-sm text-text-sub-600">
            {PROMPTS.map((p) => (
              <li key={p}>&ldquo;{p}&rdquo;</li>
            ))}
          </ul>
        </FramePanel>
      </Frame>
    </div>
  );
}
