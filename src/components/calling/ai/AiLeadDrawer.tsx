"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  RiArrowDownSLine,
  RiChat1Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPhoneLine,
  RiPlayCircleLine,
  RiRobot2Line,
  RiStopCircleLine,
  RiVoiceprintLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import * as Textarea from "@/components/alignui/textarea";
import { useDialogs } from "@/components/DialogProvider";
import { AgentVoiceRehearsal } from "@/components/calls/AgentVoiceRehearsal";
import { RecordingPlayer } from "@/components/calls/RecordingPlayer";
import { isRemoteRepCallActive, startRemoteRepCall, subscribeRemoteRepCall } from "@/components/calls/remoteRepCall";
import { formatOffset } from "@/components/calls/formatElapsed";
import { Skeleton } from "@/components/page/Skeletons";
import { AI_LEAD_MAX_INSTRUCTIONS, type AiActivityCallResult, type AiLeadActivity, type AiLeadDetail } from "@/lib/calls/aiCampaigns/api";
import { callAiLead, getAiLead, updateAiLead } from "@/lib/calls/aiCampaigns/client";
import { getCall } from "@/lib/calls/client";
import type { CallDetail } from "@/lib/calls/contract";
import { cn } from "@/utils/cn";
import { AI_OUTCOME_LABELS_PT, actionRequiredText, aiErrorPt, aiNotePt, aiStepLabelPt, AiStatusBadge, errorText, formatCallLength, formatWhen } from "./aiShared";

/** While a call is queued or on, the sheet refreshes this often. */
const LIVE_REFRESH_MS = 5_000;

const CALL_RESULT: Record<AiActivityCallResult, { label: string; color: "green" | "gray" | "orange" | "red" | "blue" }> = {
  queued: { label: "Aguardando o número", color: "blue" },
  in_progress: { label: "Em ligação", color: "blue" },
  connected: { label: "Conectado", color: "green" },
  no_answer: { label: "Sem resposta", color: "gray" },
  not_on_whatsapp: { label: "Sem WhatsApp", color: "orange" },
  failed: { label: "Falhou", color: "red" },
};

const CALL_MODE = { rep: "Ligação de um representante", agent: "Ligação do agente de IA (do notebook)", agent_cloud: "Ligação do agente de IA" } as const;

function callTitle(call: NonNullable<AiLeadActivity["call"]>): string {
  if (call.direction === "inbound") return "Ligação recebida · atendida pelo agente de IA";
  if (call.remoteRep) return call.numberName ? `Ligação de um representante (pelo ${call.numberName})` : "Ligação de um representante (pelo número de ligação)";
  return CALL_MODE[call.mode];
}

const MESSAGE_ORIGIN = {
  lead: "Eles escreveram pelo WhatsApp",
  agentsdr: "WhatsApp enviado pelo Apollo Intelligence",
  phone: "WhatsApp digitado no celular",
} as const;

const DELIVERY = {
  queued: { label: "Na fila", color: "blue" },
  sending: { label: "Enviando", color: "blue" },
  failed: { label: "Não enviada", color: "red" },
  uncertain: { label: "Entrega incerta", color: "orange" },
} as const;
const OUTCOME_COLOR = {
  meeting_booked: "green",
  interested: "green",
  human_callback: "green",
  call_back: "blue",
  not_interested: "red",
  wrong_person: "orange",
  do_not_contact: "red",
  no_response: "gray",
  other: "gray",
} as const;

/**
 * A lead's side sheet: where it stands in the campaign, trying a call on it
 * (a rehearsal in the browser, or a real call now), its own instructions, and
 * everything that happened with the person — every call and WhatsApp message,
 * from this campaign or anywhere else, newest first.
 */
export function AiLeadDrawer({
  campaignId,
  contactId,
  onClose,
  onChanged,
}: {
  campaignId: string;
  contactId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const dialogs = useDialogs();
  const [detail, setDetail] = useState<AiLeadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"stop" | "requeue" | "call" | "ai-call" | "instructions" | null>(null);
  // The rep's own call through a number (remoteRepCall.ts) — any lead's: there is one microphone.
  const repCallOn = useSyncExternalStore(subscribeRemoteRepCall, isRemoteRepCallActive, () => false);
  const [rehearsing, setRehearsing] = useState(false);
  const [instructions, setInstructions] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const next = await getAiLead(campaignId, contactId);
      setDetail(next);
      setInstructions((current) => current ?? next.lead.instructions ?? "");
      setError(null);
    } catch (cause) {
      setError(errorText(cause, "Não foi possível carregar o lead"));
    }
  }, [campaignId, contactId]);

  useEffect(() => {
    // Fetch on open; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A call queued or on: keep the feed current until it ends.
  const live = !!detail?.activity.some((entry) => entry.call && (entry.call.result === "queued" || entry.call.result === "in_progress"));
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => void load(), LIVE_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [live, load]);

  async function act(action: "stop" | "requeue") {
    setBusy(action);
    setError(null);
    try {
      await updateAiLead(campaignId, contactId, { action });
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause, "Não foi possível atualizar o lead"));
    } finally {
      setBusy(null);
    }
  }

  /** The rep's own call: they talk from this tab, through the campaign's number. */
  async function callNow() {
    const lead = detail?.lead;
    if (!lead) return;
    const who = lead.name || lead.phone;
    const confirmed = await dialogs.confirm({
      title: `Ligar para ${who} agora?`,
      description: `Você fala com ${who} pelo número desta campanha (${lead.numberName ?? "o primeiro número ativo"}) usando seu microfone. Mantenha esta aba aberta. Isso não consome uma etapa da sequência.`,
      confirmLabel: "Ligar agora",
    });
    if (!confirmed) return;
    setBusy("call");
    setError(null);
    setNotice(null);
    try {
      // How it goes (or why it did not) shows in the call bar.
      const callId = await startRemoteRepCall({
        leadName: who,
        numberName: lead.numberName,
        place: () => callAiLead(campaignId, contactId, { remoteRep: true }),
      });
      if (callId) {
        await load();
        onChanged();
      }
    } catch (cause) {
      setError(errorText(cause, "Não foi possível fazer a ligação"));
    } finally {
      setBusy(null);
    }
  }

  async function aiCall() {
    const lead = detail?.lead;
    if (!lead) return;
    const confirmed = await dialogs.confirm({
      title: `Ligação com IA para ${lead.name || lead.phone}?`,
      description: `O agente de IA faz uma ligação real pelo WhatsApp para ${lead.phone} a partir do número desta campanha, com as instruções da campanha${lead.instructions ? " e as deste lead" : ""}. Isso não consome uma etapa da sequência.`,
      confirmLabel: "Ligação com IA",
    });
    if (!confirmed) return;
    setBusy("ai-call");
    setError(null);
    setNotice(null);
    try {
      const placed = await callAiLead(campaignId, contactId);
      setNotice(`Ligando pelo ${placed.numberName ?? "número da campanha"} — começa assim que o número estiver livre.`);
      await load();
      onChanged();
    } catch (cause) {
      setError(errorText(cause, "Não foi possível fazer a ligação"));
    } finally {
      setBusy(null);
    }
  }

  async function saveInstructions() {
    setBusy("instructions");
    setError(null);
    try {
      const { lead } = await updateAiLead(campaignId, contactId, { instructions: instructions?.trim() || null });
      setDetail((current) => (current ? { ...current, lead } : current));
      setInstructions(lead.instructions ?? "");
    } catch (cause) {
      setError(errorText(cause, "Não foi possível salvar as instruções"));
    } finally {
      setBusy(null);
    }
  }

  const lead = detail?.lead ?? null;
  const summary = detail?.summary ?? null;
  const open = lead && ["queued", "reaching", "callback", "chasing"].includes(lead.status);
  const requeueable = lead && (lead.status === "failed" || lead.status === "unreached" || (lead.status === "stopped" && (lead.note ?? "").startsWith("Stopped by ")));
  const instructionsDirty = lead !== null && instructions !== null && instructions.trim() !== (lead.instructions ?? "");
  const firstName = lead?.name?.split(/\s+/)[0] || "você";

  return (
    <Modal.Root open onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.SideContent size="max-w-xl">
        <Modal.Header>
          <div className="min-w-0">
            <Modal.Title className="truncate">{lead ? lead.name || "Lead sem nome" : "Carregando…"}</Modal.Title>
            <Modal.Description className="mt-0.5 truncate text-paragraph-xs tabular-nums text-text-sub-600">
              {lead ? [lead.phone, lead.title, lead.companyName].filter(Boolean).join(" · ") : " "}
            </Modal.Description>
          </div>
        </Modal.Header>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-lg bg-error-lighter px-3 py-2 text-paragraph-xs text-error-dark ring-1 ring-inset ring-error-light">{error}</p>}
          {notice && <p role="status" className="rounded-lg bg-information-lighter px-3 py-2 text-paragraph-xs text-information-dark ring-1 ring-inset ring-information-light">{notice}</p>}
          {!lead || !summary ? (
            !error && (
              <div aria-busy="true" aria-label="Carregando" className="space-y-3">
                <Skeleton className="h-16 w-full rounded-xl" />
                <Skeleton className="h-32 w-full rounded-xl" />
              </div>
            )
          ) : (
            <>
              <section className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <AiStatusBadge status={lead.status} />
                  {lead.currentStep && <span className="text-paragraph-sm text-text-sub-600">{aiStepLabelPt(lead.currentStep)}</span>}
                  {lead.numberName && <span className="text-paragraph-xs text-text-soft-400">pelo {lead.numberName}</span>}
                </div>
                {lead.nextAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>Próxima ação {formatWhen(lead.nextAt)}</p>}
                {lead.note && <p className="text-paragraph-sm text-text-sub-600">{aiNotePt(lead.note)}</p>}
                {lead.meetingAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>Reunião {formatWhen(lead.meetingAt)}</p>}
                {lead.actionRequiredAt && <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{actionRequiredText(lead.actionRequiredAt)}</p>}
                <dl className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-paragraph-xs text-text-sub-600">
                  <Stat label="Ligações" value={summary.calls} />
                  <Stat label="Conectadas" value={summary.connected} />
                  <Stat label="Mensagens enviadas" value={summary.messagesSent} />
                  <Stat label="Respostas" value={summary.messagesReceived} />
                  {summary.crmStage && (
                    <div className="flex gap-1">
                      <dt>Estágio no CRM</dt>
                      <dd className="text-label-xs text-text-strong-950">{summary.crmStage}</dd>
                    </div>
                  )}
                </dl>
                {(open || requeueable) && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {open && (
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null} onClick={() => void act("stop")}>
                        <Button.Icon as={busy === "stop" ? RiLoader4Line : RiStopCircleLine} className={cn(busy === "stop" && "animate-spin")} />
                        Interromper este lead
                      </Button.Root>
                    )}
                    {requeueable && (
                      <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null} onClick={() => void act("requeue")}>
                        <Button.Icon as={busy === "requeue" ? RiLoader4Line : RiPlayCircleLine} className={cn(busy === "requeue" && "animate-spin")} />
                        Colocar na fila novamente
                      </Button.Root>
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <h3 className="text-label-sm text-text-strong-950">Experimentar uma ligação</h3>
                <p className="text-paragraph-xs text-text-sub-600">
                  O ensaio conversa com o agente no seu navegador como se você fosse {firstName}: nome, empresa, histórico e as instruções abaixo. Ligar agora faz uma ligação real pelo WhatsApp para essa pessoa a partir do número da campanha, com você na linha pelo microfone; Ligação com IA deixa o agente fazer no lugar. As duas são gravadas e transcritas.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" aria-expanded={rehearsing} onClick={() => setRehearsing((current) => !current)}>
                    <Button.Icon as={RiVoiceprintLine} />
                    {rehearsing ? "Fechar ensaio" : "Ensaio com este lead"}
                  </Button.Root>
                  <Button.Root variant="primary" mode="filled" size="xsmall" disabled={busy !== null || live || repCallOn} onClick={() => void callNow()}>
                    <Button.Icon as={busy === "call" ? RiLoader4Line : RiPhoneLine} className={cn(busy === "call" && "animate-spin")} />
                    {live || repCallOn ? "Há uma ligação em andamento" : "Ligar agora"}
                  </Button.Root>
                  <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy !== null || live} onClick={() => void aiCall()}>
                    <Button.Icon as={busy === "ai-call" ? RiLoader4Line : RiRobot2Line} className={cn(busy === "ai-call" && "animate-spin")} />
                    Ligação com IA
                  </Button.Root>
                </div>
                {rehearsing && (
                  <div className="pt-1">
                    {instructionsDirty && <p className="mb-2 text-paragraph-xs text-warning-dark">Salve as instruções abaixo antes para que o ensaio as use.</p>}
                    <AgentVoiceRehearsal campaignId={campaignId} contactId={contactId} />
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <label htmlFor="lead-instructions" className="block text-label-sm text-text-strong-950">Instruções para este lead</label>
                <p className="text-paragraph-xs text-text-sub-600">Só para ligações para {firstName}, além das da campanha: quem indicou, o que importa para a pessoa e o que evitar.</p>
                <Textarea.Root
                  id="lead-instructions"
                  simple
                  rows={3}
                  maxLength={AI_LEAD_MAX_INSTRUCTIONS}
                  value={instructions ?? ""}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Conheci a Ana na feira D2C de São Paulo; ela comentou que os anúncios deles levam todos a uma página de produto."
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-paragraph-xs tabular-nums text-text-soft-400">{(instructions ?? "").length}/{AI_LEAD_MAX_INSTRUCTIONS}</span>
                  <div className="flex gap-2">
                    {instructionsDirty && (
                      <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy !== null} onClick={() => setInstructions(lead.instructions ?? "")}>
                        Descartar
                      </Button.Root>
                    )}
                    <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={!instructionsDirty || busy !== null} onClick={() => void saveInstructions()}>
                      {busy === "instructions" ? "Salvando…" : "Salvar"}
                    </Button.Root>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-label-sm text-text-strong-950">Atividade</h3>
                {detail!.activity.length === 0 ? (
                  <p className="mt-2 rounded-xl bg-bg-weak-50 p-4 text-paragraph-sm text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                    Ainda não há ligações nem mensagens com {firstName}.{" "}
                    {lead.status === "queued" ? "A primeira etapa começa quando a campanha for lançada e um número estiver livre." : ""}
                  </p>
                ) : (
                  <ol className="mt-3 space-y-3 border-l border-stroke-soft-200 pl-4">
                    {detail!.activity.map((entry) => <ActivityEntry key={`${entry.kind}-${entry.id}`} entry={entry} />)}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </Modal.SideContent>
    </Modal.Root>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex gap-1">
      <dt>{label}</dt>
      <dd className="text-label-xs tabular-nums text-text-strong-950">{value}</dd>
    </div>
  );
}

function ActivityEntry({ entry }: { entry: AiLeadActivity }) {
  const Icon = entry.kind === "message" ? RiChat1Line : entry.kind === "call" ? RiPhoneLine : RiErrorWarningLine;
  const call = entry.call;
  const message = entry.message;
  const title = call
    ? callTitle(call)
    : message ? MESSAGE_ORIGIN[message.origin] : "A etapa não começou";
  const length = call?.result === "connected" ? formatCallLength(call.durationMs) : null;
  const where = call?.numberName ?? message?.numberName ?? null;
  return (
    <li className="relative">
      <span className="absolute -left-[1.4rem] top-0.5 flex size-5 items-center justify-center rounded-full bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200">
        <Icon className="size-3 text-text-sub-600" aria-hidden="true" />
      </span>
      <div className="space-y-2 rounded-xl bg-bg-weak-50 p-3 ring-1 ring-inset ring-stroke-soft-200">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-label-sm text-text-strong-950">{title}</span>
          {call && (
            <Badge.Root size="small" variant="light" color={CALL_RESULT[call.result].color}>
              {CALL_RESULT[call.result].label}{length ? ` · ${length}` : ""}
            </Badge.Root>
          )}
          {message?.delivery && <Badge.Root size="small" variant="light" color={DELIVERY[message.delivery].color}>{DELIVERY[message.delivery].label}</Badge.Root>}
          <span className="ml-auto text-paragraph-xs tabular-nums text-text-soft-400" suppressHydrationWarning>{formatWhen(entry.at)}</span>
        </div>
        {(entry.stepLabel || entry.campaignName || where) && (
          <p className="text-paragraph-xs text-text-sub-600">
            {[entry.stepLabel ? aiStepLabelPt(entry.stepLabel) : null, entry.campaignName ? `Campanha: ${entry.campaignName}` : null, where ? `${call?.direction === "inbound" ? "para" : "pelo"} ${where}` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        {entry.error && <p className="text-paragraph-xs text-error-dark">{aiErrorPt(entry.error)}</p>}
        {call?.error && call.result !== "connected" && <p className="text-paragraph-xs text-text-sub-600">{aiErrorPt(call.error)}</p>}
        {message?.error && <p className="text-paragraph-xs text-error-dark">{aiErrorPt(message.error)}</p>}
        {message && message.body && (
          <p
            className={cn(
              "max-w-md whitespace-pre-wrap break-words rounded-xl px-3.5 py-2.5 text-paragraph-sm leading-6 text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200",
              message.direction === "inbound" ? "rounded-tl-sm bg-bg-white-0" : "ml-auto rounded-tr-sm bg-information-lighter",
            )}
          >
            {message.body}
          </p>
        )}
        {call?.outcome && (
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Badge.Root variant="lighter" size="medium" color={OUTCOME_COLOR[call.outcome.outcome]} className="shrink-0 whitespace-nowrap">
                <Badge.Dot />
                {AI_OUTCOME_LABELS_PT[call.outcome.outcome]}
              </Badge.Root>
              {call.outcome.when && <span className="text-paragraph-xs text-text-sub-600">{call.outcome.when}</span>}
            </div>
            {call.outcome.summary && <p className="text-paragraph-sm text-text-sub-600">{call.outcome.summary}</p>}
          </div>
        )}
        {call?.hasRecording && <RecordingPlayer callId={call.id} offsetMs={call.recordingOffsetMs} />}
        {call && call.transcriptStatus === "done" && <Transcript callId={call.id} />}
      </div>
    </li>
  );
}

/** The call's transcript, fetched when opened. */
function Transcript({ callId }: { callId: string }) {
  const [open, setOpen] = useState(false);
  const [call, setCall] = useState<CallDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !call) {
      try {
        setCall(await getCall(callId));
      } catch (cause) {
        setError(errorText(cause, "Não foi possível carregar a transcrição"));
      }
    }
  }

  return (
    <div>
      <Button.Root variant="neutral" mode="ghost" size="xxsmall" className="-ml-2 gap-1.5 text-label-xs" aria-expanded={open} onClick={() => void toggle()}>
        <RiArrowDownSLine className={cn("size-3.5 transition", open && "rotate-180")} aria-hidden="true" />
        {open ? "Ocultar transcrição" : "Mostrar transcrição"}
      </Button.Root>
      {open && (
        <div className="mt-1 space-y-1.5 rounded-lg bg-bg-white-0 p-3 ring-1 ring-inset ring-stroke-soft-200">
          {error && <p className="text-paragraph-xs text-error-dark">{error}</p>}
          {!call && !error && <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600"><RiLoader4Line className="size-3.5 animate-spin" aria-hidden="true" />Carregando…</p>}
          {call?.transcript?.summary && <p className="pb-1 text-paragraph-xs text-text-sub-600">{call.transcript.summary}</p>}
          {call?.transcript?.utterances.map((utterance, index) => (
            <div key={index} className="flex gap-2 text-paragraph-xs">
              <span className="w-12 shrink-0 text-text-soft-400">{formatOffset(utterance.startSeconds)}</span>
              <span className={utterance.speaker === "rep" ? "w-10 shrink-0 font-medium text-information-base" : "w-10 shrink-0 font-medium text-text-sub-600"}>
                {utterance.speaker === "rep" ? (call.mode === "rep" || call.remoteRep ? "Rep." : "Agente") : "Lead"}
              </span>
              <span className="text-text-strong-950">{utterance.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
