"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SequenceStep } from "@/lib/outreach/schema";
import * as Select from "@/components/alignui/select";

type PreviewLead = { id: string; email: string; firstName: string | null; company: string | null };
type PreviewMailbox = { id: string; emailAddress: string; displayName: string | null; hasSignature: boolean };
type Preview = {
  subject: string;
  body: string;
  html: string;
  unresolved: string[];
  /** Fields this lead lacks that send their fallback text instead. */
  usedFallback?: string[];
  lead: PreviewLead | null;
  mailbox: PreviewMailbox | null;
};

/**
 * Renders a sequence step the way it will actually be sent, for a chosen lead
 * and mailbox. The rendering happens server-side through the same pipeline the
 * scheduler uses (lib/outreach/render.ts), so what shows here is what goes out.
 *
 * Re-rolling matters for spin-text: {A|B} picks randomly per send, so the
 * reload button is how you check every variant reads correctly.
 */
export default function PreviewModal({
  campaignId,
  step,
  onClose,
}: {
  campaignId: string;
  step: SequenceStep;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<PreviewLead[]>([]);
  const [mailboxes, setMailboxes] = useState<PreviewMailbox[]>([]);
  const [leadId, setLeadId] = useState<string | undefined>();
  const [mailboxId, setMailboxId] = useState<string | undefined>();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /** POSTs the step and shows the result. Every trigger funnels through here. */
  const render = useCallback(
    async (opts: { leadId?: string; mailboxId?: string } = {}) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/outreach/campaigns/${campaignId}/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step, leadId: opts.leadId ?? leadId, mailboxId: opts.mailboxId ?? mailboxId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "Failed to render preview");
          setPreview(null);
          return;
        }
        setPreview(data as Preview);
      } catch {
        setError("Failed to render preview");
      } finally {
        setLoading(false);
      }
    },
    [campaignId, step, leadId, mailboxId],
  );

  // One bootstrap on open: fill the pickers, then render with their defaults.
  // Runs once per campaign; later renders come from the handlers below.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [leadData, mailboxData] = await Promise.all([
        fetch(`/api/outreach/campaigns/${campaignId}/leads`).then((r) => (r.ok ? r.json() : null)),
        fetch(`/api/outreach/mailboxes`).then((r) => (r.ok ? r.json() : null)),
      ]);
      if (cancelled) return;
      const ls = (leadData?.leads ?? []) as PreviewLead[];
      const ms = (mailboxData?.mailboxes ?? []) as PreviewMailbox[];
      setLeads(ls);
      setMailboxes(ms);
      setLeadId(ls[0]?.id);
      setMailboxId(ms[0]?.id);
      await render({ leadId: ls[0]?.id, mailboxId: ms[0]?.id });
    })();
    return () => {
      cancelled = true;
    };
    // Deliberately mount-only: render() changes identity with every picker
    // change, and re-running the bootstrap would reset the user's selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // {{key|fallback}} is not spin text: drop merge fields before looking.
  const hasSpinText = /\{[^{}]*\|[^{}]*\}/.test(`${step.subject} ${step.body}`.replace(/\{\{[^{}]*\}\}/g, ""));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-apollo-graphite-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-white-0 rounded-2xl shadow-2xl w-full max-w-2xl z-10 flex flex-col max-h-[85vh]">
        <div className="p-5 border-b border-stroke-soft-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-text-strong-950">Prévia · etapa {step.stepNumber}</h2>
            <button onClick={onClose} type="button" className="text-text-strong-950/35 hover:text-text-strong-950 transition-colors text-lg leading-none">
              ×
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select.Root size="xsmall" value={leadId ?? ""} onValueChange={(value) => { setLeadId(value); void render({ leadId: value }); }}>
              <Select.Trigger className="max-w-60"><Select.Value /></Select.Trigger>
              <Select.Content>
                {leads.length === 0 && <Select.Item value="">Nenhum lead importado</Select.Item>}
                {leads.map((l) => (
                  <Select.Item key={l.id} value={l.id}>
                    {l.firstName ? `${l.firstName} · ${l.email}` : l.email}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <Select.Root size="xsmall" value={mailboxId ?? ""} onValueChange={(value) => { setMailboxId(value); void render({ mailboxId: value }); }}>
              <Select.Trigger className="max-w-60"><Select.Value /></Select.Trigger>
              <Select.Content>
                  {mailboxes.length === 0 && <Select.Item value="">Nenhuma caixa de entrada</Select.Item>}
                {mailboxes.map((m) => (
                  <Select.Item key={m.id} value={m.id}>
                    {m.emailAddress}
                    {m.hasSignature ? "" : " (sem assinatura)"}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>

            <button
              onClick={() => void render()}
              type="button"
              disabled={loading}
              title={hasSpinText ? "Sortear novas variações" : "Gerar novamente"}
              className="h-8 px-2.5 rounded-lg border border-stroke-soft-200 text-xs font-semibold text-text-strong-950/70 hover:bg-bg-weak-50 disabled:opacity-50 transition-colors"
            >
              {loading ? "…" : "↻ Recarregar"}
            </button>

            {hasSpinText && <span className="text-[11px] text-text-strong-950/35">recarregar sortea variações {"{A|B}"}</span>}
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          {error && <p className="text-sm text-error-base">{error}</p>}

          {!error && preview && (
            <>
              {preview.unresolved.length > 0 && (
                <div className="mb-4 rounded-lg bg-warning-lighter border border-warning-light px-3 py-2">
                  <p className="text-xs text-warning-dark">
                    <span className="font-semibold">Vazios para este lead:</span>{" "}
                    <span className="font-mono">{preview.unresolved.map((t) => `{{${t}}}`).join(", ")}</span>. Eles aparecem em
                    branco. Adicione um texto alternativo, verifique outro lead ou escolha outra coluna.
                  </p>
                </div>
              )}
              {(preview.usedFallback?.length ?? 0) > 0 && (
                <p className="mb-4 text-xs text-text-sub-600">
                  Este lead não tem <span className="font-mono">{preview.usedFallback!.map((t) => `{{${t}}}`).join(", ")}</span>, então o
                  texto alternativo é usado.
                </p>
              )}

              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-strong-950/35">De</div>
              <p className="text-sm text-text-strong-950 mb-3">
                {preview.mailbox
                  ? `${preview.mailbox.displayName ? `${preview.mailbox.displayName} · ` : ""}${preview.mailbox.emailAddress}`
                  : (
                    <>
                      Nenhuma caixa conectada ·{" "}
                      <Link href="/settings/email-accounts" className="text-primary-base underline-offset-2 hover:underline">
                        Adicionar caixa
                      </Link>
                    </>
                  )}
              </p>

              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-strong-950/35">Para</div>
              <p className="text-sm text-text-strong-950 mb-3">{preview.lead?.email ?? "—"}</p>

              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-strong-950/35">Assunto</div>
              <p className={`text-sm mb-4 ${preview.subject.trim() ? "text-text-strong-950 font-semibold" : "text-text-strong-950/35 italic"}`}>
                {preview.subject.trim() || "(vazio — continuará a conversa anterior)"}
              </p>

              <div className="mb-1 text-[11px] uppercase tracking-wide text-text-strong-950/35">Corpo</div>
              {/* Rendered as HTML because that is the part recipients actually
                  see — it is how you confirm links arrive clickable. The markup
                  is built by toHtmlBody(), which escapes the text first. */}
              <div
                className="text-sm text-text-strong-950 bg-bg-weak-50 rounded-lg p-3 border border-stroke-soft-200 [&_a]:text-complement-medium [&_a]:underline break-words"
                dangerouslySetInnerHTML={{ __html: preview.html }}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
