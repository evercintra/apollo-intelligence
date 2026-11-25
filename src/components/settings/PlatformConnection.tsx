"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { RiArrowDownSLine, RiCheckLine, RiExternalLinkLine, RiEyeLine, RiEyeOffLine, RiFileCopyLine, RiFileUploadLine } from "@remixicon/react";

import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { DocsLink } from "@/components/page/DocsLink";
import { useDialogs } from "@/components/DialogProvider";
import { Callout, Field } from "@/components/settings/SettingsKit";
import {
  PLATFORM_INTEGRATIONS,
  type LangfusePromptUpload,
  type PlatformIntegration,
  type PlatformKey,
  type PlatformStatus,
  type SetupStep,
  type UnipileWebhookRegistration,
} from "@/lib/platform/catalog";
import { cn } from "@/utils/cn";

/**
 * One platform integration as its channel's Connection section shows it
 * (Settings → Email / LinkedIn / WhatsApp → Connection): the card with its
 * status, Edit and Disconnect, and the guided setup dialog. `note` explains a
 * connection shared with another channel (Unipile powers LinkedIn and
 * WhatsApp).
 *
 * The catalog is imported here rather than passed from the page: it carries
 * functions (keyFile.read), which cannot cross the server/client boundary.
 */
export function PlatformConnection({
  platformKey,
  status,
  note,
  webhookUrl,
}: {
  platformKey: PlatformKey;
  status: PlatformStatus | null;
  note?: string;
  /**
   * A URL to paste into the provider's webhook settings (Cal.com), built on
   * the server with the organization in it. Undefined: none; null: this
   * deployment has no public URL to build it from.
   */
  webhookUrl?: string | null;
}) {
  const integration = PLATFORM_INTEGRATIONS.find((candidate) => candidate.key === platformKey)!;
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-4">
      {note && <Callout tone="info">{note}</Callout>}
      <PlatformCard integration={integration} status={status} webhookUrl={webhookUrl} onEdit={() => setEditing(true)} />
      {editing && <IntegrationDialog key={integration.key} integration={integration} status={status} onClose={() => setEditing(false)} />}
    </div>
  );
}

/** A connection that is planned but not built yet: shown so people know it is coming. */
export type ComingSoonConnection = { name: string; description: string; iconUrl: string; enables: string[] };

export function ComingSoonCard({ connection }: { connection: ComingSoonConnection }) {
  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <PlatformLogo src={connection.iconUrl} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-label-md text-text-strong-950">{connection.name}</h3>
              <Badge.Root size="medium" variant="lighter" color="purple">Em breve</Badge.Root>
            </div>
            <p className="mt-1 text-paragraph-sm text-text-sub-600">{connection.description}</p>
            <p className="mt-1 text-paragraph-xs text-text-sub-600">Habilitará: {connection.enables.join(", ")}</p>
          </div>
        </div>
        <Button.Root variant="neutral" mode="stroke" size="small" disabled className="shrink-0">
          Em breve
        </Button.Root>
      </FramePanel>
    </Frame>
  );
}

function PlatformCard({
  integration,
  status,
  webhookUrl,
  onEdit,
}: {
  integration: PlatformIntegration;
  status: PlatformStatus | null;
  webhookUrl?: string | null;
  onEdit: () => void;
}) {
  const router = useRouter();
  const dialogs = useDialogs();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const connected = status?.connected ?? false;

  const shownValues = integration.fields.filter((field) => !field.secret && status?.values[field.key]);

  async function disconnect() {
    const confirmed = await dialogs.confirm({
      title: `Desconectar ${integration.name}?`,
      description: `${integration.enables.join(" e ")} deixarão de funcionar até a conexão ser restabelecida.`,
      confirmLabel: "Desconectar",
      variant: "error",
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/settings/integrations/${integration.key}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      startTransition(() => router.refresh());
    } catch {
      await dialogs.alert({ title: `Não foi possível desconectar ${integration.name}`, description: "Algo deu errado. Tente de novo.", variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <PlatformLogo src={integration.iconUrl} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-label-md text-text-strong-950">{integration.name}</h3>
                <Badge.Root size="medium" variant="light" color={connected ? "green" : "gray"}>
                  {connected ? "Conectado" : "Não conectado"}
                </Badge.Root>
              </div>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">{integration.description}</p>
              <p className="mt-1 text-paragraph-xs text-text-sub-600">Habilita: {integration.enables.join(", ")}</p>
              {connected && integration.guideUrl && (
                <DocsLink href={integration.guideUrl} appearance="inline" className="mt-1.5 text-paragraph-xs">
                  Guia de configuração
                </DocsLink>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!connected && integration.guideUrl && <DocsLink href={integration.guideUrl} />}
            {connected && (
              <Button.Root variant="error" mode="ghost" size="small" disabled={busy} onClick={disconnect}>
                Desconectar
              </Button.Root>
            )}
            <Button.Root variant={connected ? "neutral" : "primary"} mode={connected ? "stroke" : "filled"} size="small" onClick={onEdit}>
              {connected ? "Editar" : "Conectar"}
            </Button.Root>
          </div>
        </div>

        {connected && (shownValues.length > 0 || status?.verifiedAt) && (
          <dl className="grid gap-x-6 gap-y-2 border-t border-stroke-soft-200 pt-3 text-paragraph-xs sm:grid-cols-2">
            {shownValues.map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="text-text-sub-600">{field.label}</dt>
                <dd className="truncate text-text-strong-950">{status?.values[field.key]}</dd>
              </div>
            ))}
            {status?.verifiedAt && (
              <div>
                <dt className="text-text-sub-600">Última verificação</dt>
                <dd className="text-text-strong-950">{formatVerified(status.verifiedAt)}</dd>
              </div>
            )}
          </dl>
        )}

        {connected && integration.key === "unipile" && <UnipileWebhooks registration={status?.webhooks ?? null} />}
        {connected && integration.key === "langfuse" && <LangfusePrompts upload={status?.prompts ?? null} />}
        {webhookUrl !== undefined && (
          <section className="flex flex-col gap-1.5 border-t border-stroke-soft-200 pt-3">
            <span className="text-label-xs text-text-strong-950">URL do webhook</span>
            {webhookUrl ? (
              <>
                <CopyValue value={webhookUrl} />
                <p className="text-paragraph-xs text-text-sub-600">
                  Cole como a URL de assinatura de um webhook do {integration.name}. Ela identifica sua organização, então mantenha uma por organização.
                </p>
              </>
            ) : (
              <p className="text-paragraph-xs text-text-sub-600">Defina BETTER_AUTH_URL com o endereço público desta instalação para obter a URL do webhook.</p>
            )}
          </section>
        )}
      </FramePanel>
    </Frame>
  );
}

/**
 * Os prompts que a automação envia a um projeto Langfuse ao salvar:
 * quantos foram criados ou por que não foi possível. Salvar de novo tenta outra vez.
 */
function LangfusePrompts({ upload }: { upload: LangfusePromptUpload | null }) {
  const badge =
    upload?.status === "uploaded"
      ? { color: "green" as const, text: "Enviados ao Langfuse" }
      : upload?.status === "failed"
        ? { color: "red" as const, text: "Falha no envio" }
        : { color: "gray" as const, text: "Ainda não enviado" };
  const prompts = (count: number) => `${count} ${count === 1 ? "prompt" : "prompts"}`;
  return (
    <section className="flex flex-col gap-1 border-t border-stroke-soft-200 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-label-sm text-text-strong-950">Prompts</h4>
        <Badge.Root size="small" variant="light" color={badge.color}>
          {badge.text}
        </Badge.Root>
      </div>
      <p className="text-paragraph-xs text-text-sub-600">
        {upload?.status === "uploaded"
          ? `Em ${formatVerified(upload.at)}, a automação enviou ${prompts(upload.created)} a este projeto, marcados como produção${upload.existing ? `; ${prompts(upload.existing)} já estavam lá e foram mantidos como estavam` : ""}. Edite no Langfuse: a automação usa a versão de produção.`
          : upload?.status === "failed"
            ? `${upload.message ?? "O Langfuse não aceitou os prompts."} Edite e salve a conexão para tentar de novo.`
            : "A automação envia seus prompts quando a conexão é salva. Edite e salve para enviá-los."}
      </p>
    </section>
  );
}

type WebhookSetup = { endpoints: { key: string; label: string; url: string }[] | null; secret: string };

/**
 * Webhooks da Unipile, registrados pela automação ao salvar: se funcionou,
 * uma forma de repetir e, sob demanda, as URLs e o segredo para registrar
 * manualmente.
 */
function UnipileWebhooks({ registration }: { registration: UnipileWebhookRegistration | null }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, setCurrent] = useState(registration);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState<WebhookSetup | null>(null);
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [secretShown, setSecretShown] = useState(false);

  async function register() {
    setRegistering(true);
    setError("");
    try {
      const res = await fetch("/api/settings/integrations/unipile/webhooks", { method: "POST" });
      const body = (await res.json().catch(() => null)) as (UnipileWebhookRegistration & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || "Não foi possível registrar os webhooks.");
      setCurrent(body);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar os webhooks.");
    } finally {
      setRegistering(false);
    }
  }

  async function toggleSetup() {
    if (setup) {
      setSetup(null);
      setSecretShown(false);
      return;
    }
    setLoadingSetup(true);
    setError("");
    try {
      const res = await fetch("/api/settings/integrations/unipile/webhooks", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as (WebhookSetup & { error?: string }) | null;
      if (!res.ok || !body) throw new Error(body?.error || "Não foi possível carregar os detalhes do webhook.");
      setSetup(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os detalhes do webhook.");
    } finally {
      setLoadingSetup(false);
    }
  }

  const badge =
    current?.status === "registered"
      ? { color: "green" as const, text: `${current.items?.length ?? 0} registrados` }
      : current?.status === "failed"
        ? { color: "red" as const, text: "Falha no registro" }
        : current?.status === "skipped"
          ? { color: "orange" as const, text: "Não registrados" }
          : { color: "gray" as const, text: "Ainda não registrados" };

  return (
    <section className="flex flex-col gap-3 border-t border-stroke-soft-200 pt-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-label-sm text-text-strong-950">Webhooks</h4>
            <Badge.Root size="small" variant="light" color={badge.color}>
              {badge.text}
            </Badge.Root>
          </div>
          <p className="mt-1 text-paragraph-xs text-text-sub-600">
            {current?.status === "registered"
              ? `A automação os registrou no seu espaço Unipile em ${formatVerified(current.at)}, para que respostas, convites aceitos e mensagens de WhatsApp cheguem aqui.`
              : current?.message
                ? current.message
                : "A automação registra os webhooks no seu espaço Unipile, para que respostas, convites aceitos e mensagens de WhatsApp cheguem aqui."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button.Root variant="neutral" mode="ghost" size="small" disabled={loadingSetup} onClick={() => void toggleSetup()}>
            {setup ? "Ocultar URLs" : loadingSetup ? "Carregando…" : "Mostrar URLs e segredo"}
          </Button.Root>
          <Button.Root variant="neutral" mode="stroke" size="small" disabled={registering} onClick={() => void register()}>
            {registering ? "Registrando…" : current?.status === "registered" ? "Registrar de novo" : "Registrar webhooks"}
          </Button.Root>
        </div>
      </div>

      {error && <Callout tone="error">{error}</Callout>}

      {setup && (
        <div className="flex flex-col gap-3 rounded-lg bg-bg-weak-50 p-3">
          <p className="text-paragraph-xs text-text-sub-600">
            Necessário apenas para registrar os webhooks manualmente. Cada URL é chamada com o cabeçalho <code className="font-mono">x-unipile-secret</code> definido como o segredo abaixo.
          </p>
          {setup.endpoints ? (
            <ul className="flex flex-col gap-2">
              {setup.endpoints.map((endpoint) => (
                <li key={endpoint.key} className="flex flex-col gap-1">
                  <span className="text-label-xs text-text-strong-950">{endpoint.label}</span>
                  <CopyValue value={endpoint.url} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-paragraph-xs text-text-sub-600">Defina BETTER_AUTH_URL com o endereço público da aplicação para obter as URLs dos webhooks.</p>
          )}
          <div className="flex flex-col gap-1">
            <span className="text-label-xs text-text-strong-950">Segredo</span>
            <CopyValue value={setup.secret} masked={!secretShown} onToggleMask={() => setSecretShown((shown) => !shown)} />
          </div>
        </div>
      )}
    </section>
  );
}

/** A value on one line with Copy; optionally masked behind a show/hide toggle. */
function CopyValue({ value, masked = false, onToggleMask }: { value: string; masked?: boolean; onToggleMask?: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is selectable text (once shown).
    }
  }
  return (
    <div className="flex items-start gap-2 rounded-md bg-bg-white-0 p-2 ring-1 ring-inset ring-stroke-soft-200">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-paragraph-xs text-text-strong-950">
        {masked ? "•".repeat(Math.min(value.length, 32)) : value}
      </code>
      {onToggleMask && (
        <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={onToggleMask} aria-label={masked ? "Mostrar segredo" : "Ocultar segredo"}>
          <Button.Icon as={masked ? RiEyeLine : RiEyeOffLine} />
        </Button.Root>
      )}
      <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={() => void copy()}>
        <Button.Icon as={copied ? RiCheckLine : RiFileCopyLine} />
        {copied ? "Copiado" : "Copiar"}
      </Button.Root>
    </div>
  );
}

/** "Como conectar", fechado até ser solicitado — as dicas dos campos bastam na maioria dos casos. */
function SetupGuide({ integration }: { integration: PlatformIntegration }) {
  const [open, setOpen] = useState(false);
  const id = `setup-guide-${integration.key}`;
  return (
    <section className="rounded-lg bg-bg-weak-50">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary-base"
      >
        <span className="text-label-sm text-text-strong-950">
          Como conectar
          <span className="ml-1.5 text-paragraph-xs text-text-sub-600">{integration.setupSteps.length} {integration.setupSteps.length === 1 ? "etapa" : "etapas"}</span>
        </span>
        <RiArrowDownSLine aria-hidden="true" className={cn("size-5 shrink-0 text-text-sub-600 transition-transform duration-200", open && "rotate-180")} />
      </button>
      {open && (
        <ol id={id} className="space-y-1.5 px-3.5 pb-3.5">
          {integration.setupSteps.map((step, index) => (
            <li key={index} className="flex gap-2 text-paragraph-sm text-text-sub-600">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-bg-white-0 text-label-xs text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200">
                {index + 1}
              </span>
              <SetupStepText step={step} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function SetupStepText({ step }: { step: SetupStep }) {
  const [copied, setCopied] = useState(false);
  if (typeof step === "string") return <span className="min-w-0 flex-1">{step}</span>;

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the value is selectable text, so it can still be copied by hand.
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span>{step.text}</span>
      <div className="flex items-start gap-2 rounded-md bg-bg-white-0 p-2 ring-1 ring-inset ring-stroke-soft-200">
        <code className="min-w-0 flex-1 select-all break-all font-mono text-paragraph-xs text-text-strong-950">{step.copy}</code>
        <Button.Root type="button" variant="neutral" mode="ghost" size="xxsmall" onClick={() => void copy(step.copy)}>
          <Button.Icon as={copied ? RiCheckLine : RiFileCopyLine} />
          {copied ? "Copiado" : "Copiar"}
        </Button.Root>
      </div>
    </div>
  );
}

/**
 * The provider's mark on a white tile in both themes — the marks are drawn
 * for a light background (OpenRouter's is black), so the tile keeps them
 * legible in dark mode.
 */
export function PlatformLogo({ src, size = "medium" }: { src: string; size?: "small" | "medium" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-inset ring-stroke-soft-200",
        size === "medium" ? "size-10 p-2" : "size-9 p-1.5",
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a static brand asset from public/ */}
      <img src={src} alt="" className="size-full object-contain" />
    </span>
  );
}

function formatVerified(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function IntegrationDialog({
  integration,
  status,
  onClose,
}: {
  integration: PlatformIntegration;
  status: PlatformStatus | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(integration.fields.map((field) => [field.key, field.secret ? "" : (status?.values[field.key] ?? "")])),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filledFrom, setFilledFrom] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const secretsSet = new Set(status?.secretsSet ?? []);
  const connected = status?.connected ?? false;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/settings/integrations/${integration.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data: { error?: string } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar a integração");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Erro de rede — tente de novo");
    } finally {
      setSaving(false);
    }
  }

  async function readKeyFile(file: File) {
    if (!integration.keyFile) return;
    setError(null);
    setFilledFrom(null);
    try {
      const filled = integration.keyFile.read(await file.text());
      setValues((current) => ({ ...current, ...filled }));
      setFilledFrom(file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ler esse arquivo");
    }
  }

  const links = [
    integration.guideUrl && { href: integration.guideUrl, label: "Guia passo a passo" },
    integration.videoUrl && { href: integration.videoUrl, label: "Ver como" },
    integration.docsUrl && { href: integration.docsUrl, label: `Documentação do ${integration.name}` },
  ].filter((link): link is { href: string; label: string } => Boolean(link));

  const missing = integration.fields.some(
    (field) => field.required && !values[field.key].trim() && !(field.secret && secretsSet.has(field.key)),
  );

  return (
    <Modal.Root open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
      <Modal.Content size="max-w-xl" hideClose={saving} onEscapeKeyDown={(event) => saving && event.preventDefault()}>
        <Modal.Header>
          <div className="flex items-start gap-3">
            <PlatformLogo src={integration.iconUrl} size="small" />
            <div className="min-w-0">
              <Modal.Title>{connected ? `Editar ${integration.name}` : `Conectar ${integration.name}`}</Modal.Title>
              <Modal.Description>
                Tudo é testado com {integration.name} antes de salvar.
              </Modal.Description>
              {links.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-paragraph-xs">
                  {links.map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-primary-base underline-offset-2 hover:underline">
                      {link.label} <RiExternalLinkLine className="size-3.5" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal.Header>

        <form onSubmit={submit} className="flex min-h-0 flex-col">
          <Modal.Body className="space-y-4">
            <SetupGuide integration={integration} />

            {integration.keyFile && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInput}
                  type="file"
                  accept={integration.keyFile.accept}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void readKeyFile(file);
                  }}
                />
                <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={saving} onClick={() => fileInput.current?.click()}>
                  <Button.Icon as={RiFileUploadLine} />
                  {integration.keyFile.label}
                </Button.Root>
                <span className="text-paragraph-xs text-text-sub-600">
                  {filledFrom ? `Preenchido a partir de ${filledFrom} — confira os valores e conecte.` : "Preenche os campos abaixo. O arquivo fica no seu navegador."}
                </span>
              </div>
            )}
            {integration.fields.map((field) => {
              const id = `platform-${integration.key}-${field.key}`;
              const saved = field.secret && secretsSet.has(field.key);
              const placeholder = saved ? "Salvo — deixe em branco para manter" : field.placeholder;
              const set = (value: string) => setValues((current) => ({ ...current, [field.key]: value }));
              return (
                <Field key={field.key} label={field.label} htmlFor={id} required={field.required} optional={!field.required} description={field.help}>
                  {field.inputType === "textarea" ? (
                    <Textarea.Root
                      id={id}
                      simple
                      rows={6}
                      value={values[field.key]}
                      onChange={(e) => set(e.target.value)}
                      placeholder={placeholder}
                      spellCheck={false}
                      autoComplete="off"
                      className="font-mono text-paragraph-xs"
                    />
                  ) : (
                    <Input.Root size="medium">
                      <Input.Wrapper>
                        <Input.Input
                          id={id}
                          type={field.inputType}
                          value={values[field.key]}
                          onChange={(e) => set(e.target.value)}
                          placeholder={placeholder}
                          spellCheck={false}
                          autoComplete="off"
                        />
                      </Input.Wrapper>
                    </Input.Root>
                  )}
                </Field>
              );
            })}

            {error && (
              <Callout tone="error" title="Não foi possível conectar">
                {error}
              </Callout>
            )}
          </Modal.Body>

          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={saving} onClick={onClose}>
              Cancelar
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={saving || missing}>
              {saving ? "Testando…" : connected ? "Salvar" : "Conectar e testar"}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
