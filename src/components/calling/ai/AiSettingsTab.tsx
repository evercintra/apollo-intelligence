"use client";

import { useEffect, useMemo, useState } from "react";
import { RiArchiveLine, RiErrorWarningLine, RiLoader4Line, RiPauseCircleLine, RiPlayCircleLine, RiSaveLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { VoicePreviewButton } from "@/components/calls/VoicePreviewButton";
import { BookingLinkField } from "./BookingLinkField";
import { KnowledgePicker } from "./KnowledgePicker";
import * as Select from "@/components/alignui/select";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { TextField } from "@/components/calls/fields";
import { AGENT_VOICES, DEFAULT_AGENT_NAME, DEFAULT_AGENT_VOICE, MAX_AGENT_NAME_CHARS } from "@/lib/calls/contract";
import {
  AI_CAMPAIGN_MAX_BOOKING_MESSAGE,
  AI_CAMPAIGN_MAX_INSTRUCTIONS,
  aiSettingsError,
  type AiCampaignDetail,
  type UpdateAiCampaignRequest,
} from "@/lib/calls/aiCampaigns/api";
import { AI_CAMPAIGN_GOALS, AI_CAMPAIGN_MAX_CALLBACKS, type AiCampaignGoal } from "@/lib/calls/aiCampaigns/contract";
import { listCallingStations } from "@/lib/calls/client";
import { setAiCampaignStations, updateAiCampaign } from "@/lib/calls/aiCampaigns/client";
import type { CallingStation } from "@/lib/calls/stationContract";
import { aiApi } from "@/lib/calls/aiCampaigns/client";
import { accentFlag, DEFAULT_ELEVENLABS_VOICE, type ElevenLabsVoice } from "@/lib/calls/elevenlabs/contract";
import { cn } from "@/utils/cn";
import { AGENT_VOICE_LABELS_PT, AI_GOAL_TEXT_PT, aiErrorPt, elevenLabsVoiceLabelPt, errorText, NumberPicker, useBeforeUnload } from "./aiShared";

const DEFAULT_VOICE = "default";

type Draft = {
  goal: AiCampaignGoal;
  instructions: string;
  agentName: string;
  agentVoice: string;
  voiceEngine: "gemini" | "elevenlabs";
  elevenlabsVoice: string;
  bookingUrl: string;
  bookingMessage: string;
  maxCallbacks: number;
  knowledgeIds: string[] | null;
};

const draftOf = (campaign: AiCampaignDetail): Draft => ({
  goal: campaign.goal,
  instructions: campaign.instructions,
  agentName: campaign.agentName ?? "",
  agentVoice: campaign.agentVoice ?? DEFAULT_VOICE,
  voiceEngine: campaign.voiceEngine,
  elevenlabsVoice: campaign.elevenlabsVoice ?? DEFAULT_ELEVENLABS_VOICE,
  bookingUrl: campaign.bookingUrl ?? "",
  bookingMessage: campaign.bookingMessage,
  maxCallbacks: campaign.maxCallbacks,
  knowledgeIds: campaign.knowledgeIds,
});

/** The Settings tab: what the calls are for, the agent, booking, call-backs, numbers, and pause / archive. */
export function AiSettingsTab({
  campaign,
  onSaved,
  onToggle,
  onArchive,
  toggling,
}: {
  campaign: AiCampaignDetail;
  onSaved: () => void;
  onToggle: () => void;
  onArchive: () => void;
  toggling: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(campaign));
  const [saved, setSaved] = useState<Draft>(() => draftOf(campaign));
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stations, setStations] = useState<CallingStation[] | null>(null);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const savedNumberIds = useMemo(() => campaign.numbers.map((number) => number.id), [campaign.numbers]);
  const [numberIds, setNumberIds] = useState<string[]>(savedNumberIds);
  const [savingNumbers, setSavingNumbers] = useState(false);
  const [numbersError, setNumbersError] = useState<string | null>(null);

  // ElevenLabs' Indian-English voices, when ElevenLabs is connected (Settings → AI provider).
  const [elevenVoices, setElevenVoices] = useState<ElevenLabsVoice[] | null>(null);
  const [elevenError, setElevenError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    aiApi<{ voices: ElevenLabsVoice[] }>("/api/calling/agent/elevenlabs-voices")
      .then((response) => { if (!cancelled) setElevenVoices(response.voices); })
      .catch((cause) => { if (!cancelled) setElevenError(aiErrorPt(errorText(cause, "Não foi possível carregar as vozes da ElevenLabs"))); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    listCallingStations()
      .then((response) => { if (!cancelled) setStations(response.stations); })
      .catch((cause) => { if (!cancelled) setStationsError(aiErrorPt(errorText(cause, "Não foi possível carregar os números"))); });
    return () => { cancelled = true; };
  }, []);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const numbersDirty = [...numberIds].sort().join() !== [...savedNumberIds].sort().join();
  useBeforeUnload(dirty || numbersDirty);

  const handover = draft.goal === "human_callback";
  const problem = aiSettingsError({
    goal: draft.goal,
    instructions: draft.instructions,
    bookingUrl: handover ? null : draft.bookingUrl.trim() || null,
    bookingMessage: draft.bookingMessage,
    maxCallbacks: draft.maxCallbacks,
  });
  const nameTooLong = draft.agentName.trim().length > MAX_AGENT_NAME_CHARS;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setJustSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    if (problem) { setError(aiErrorPt(problem)); return; }
    setSaving(true);
    setError(null);
    try {
      const request: UpdateAiCampaignRequest = {
        goal: draft.goal,
        instructions: draft.instructions,
        agentName: draft.agentName.trim() || null,
        agentVoice: draft.agentVoice === DEFAULT_VOICE ? null : draft.agentVoice,
        voiceEngine: draft.voiceEngine,
        elevenlabsVoice: draft.elevenlabsVoice === DEFAULT_ELEVENLABS_VOICE ? null : draft.elevenlabsVoice,
        bookingUrl: handover ? null : draft.bookingUrl.trim() || null,
        bookingMessage: draft.bookingMessage,
        maxCallbacks: draft.maxCallbacks,
        knowledgeIds: draft.knowledgeIds,
      };
      const updated = await updateAiCampaign(campaign.id, request);
      const next = draftOf(updated);
      setDraft(next);
      setSaved(next);
      setJustSaved(true);
      onSaved();
    } catch (cause) {
      setError(aiErrorPt(errorText(cause, "Não foi possível salvar as configurações")));
    } finally {
      setSaving(false);
    }
  }

  async function saveNumbers() {
    setSavingNumbers(true);
    setNumbersError(null);
    try {
      await setAiCampaignStations(campaign.id, numberIds);
      onSaved();
    } catch (cause) {
      setNumbersError(aiErrorPt(errorText(cause, "Não foi possível salvar os números")));
    } finally {
      setSavingNumbers(false);
    }
  }

  const launched = campaign.state !== "draft";

  return (
    <div className="space-y-4">
      <Frame>
        <FrameHeader title="Objetivo das ligações" description="O objetivo define o que o agente oferece quando um lead demonstra interesse." />
        <FramePanel>
          <div role="radiogroup" aria-label="Objetivo" className="grid gap-2 sm:grid-cols-3">
            {AI_CAMPAIGN_GOALS.map((goal) => {
              const active = draft.goal === goal;
              return (
                <button
                  key={goal}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set("goal", goal)}
                  className={cn(
                    "rounded-xl p-3.5 text-left outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-primary-base",
                    active ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200 hover:bg-bg-weak-50",
                  )}
                >
                  <span className="block text-label-sm text-text-strong-950">{AI_GOAL_TEXT_PT[goal].label}</span>
                  <span className="mt-1 block text-paragraph-xs text-text-sub-600">{AI_GOAL_TEXT_PT[goal].help}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-5">
            <label className="mb-1.5 block text-label-sm text-text-strong-950">Conhecimento</label>
            <KnowledgePicker value={draft.knowledgeIds} onChange={(ids) => set("knowledgeIds", ids)} />
          </div>

          <div className="mt-5">
            <label htmlFor="ai-instructions" className="mb-1.5 block text-label-sm text-text-strong-950">Instruções da campanha</label>
            <p className="mb-2 text-paragraph-xs text-text-sub-600">
              Sobre o que cada ligação vai falar, além do Conhecimento acima: para quem você está ligando, o que oferece e o que precisa descobrir. Cada etapa de ligação pode adicionar instruções específicas.
            </p>
            <Textarea.Root
              id="ai-instructions"
              simple
              rows={8}
              maxLength={AI_CAMPAIGN_MAX_INSTRUCTIONS}
              value={draft.instructions}
              onChange={(event) => set("instructions", event.target.value)}
              placeholder="Você está ligando para fundadores de marcas D2C que anunciam no Meta. Ajudamos eles a … Descubra se gastam mais de ₹5 lakh por mês em anúncios …"
            />
            <div className="mt-1 flex justify-end text-paragraph-xs tabular-nums text-text-soft-400">{draft.instructions.length}/{AI_CAMPAIGN_MAX_INSTRUCTIONS}</div>
          </div>
        </FramePanel>
      </Frame>

      <Frame>
        <FrameHeader title="O agente" description="Como o agente se apresenta. Todas as ligações usam o mesmo nome e a mesma voz, para que o lead fale sempre com uma pessoa." />
        <FramePanel>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Nome do agente"
              value={draft.agentName}
              onChange={(value) => set("agentName", value)}
              placeholder={DEFAULT_AGENT_NAME}
              maxLength={MAX_AGENT_NAME_CHARS + 10}
              aria-invalid={nameTooLong || undefined}
            />
            <div>
              <label className="mb-1.5 block text-label-sm text-text-strong-950">Motor de voz</label>
              <Select.Root size="small" value={draft.voiceEngine} onValueChange={(value) => set("voiceEngine", value as Draft["voiceEngine"])}>
                <Select.Trigger aria-label="Motor de voz"><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="gemini">Gemini Live</Select.Item>
                  <Select.Item value="elevenlabs" disabled={!elevenVoices && draft.voiceEngine !== "elevenlabs"}>ElevenLabs (rápida, em inglês)</Select.Item>
                </Select.Content>
              </Select.Root>
              {elevenError && draft.voiceEngine === "gemini" ? (
                <p className="mt-1 text-paragraph-xs text-text-sub-600">Conecte a ElevenLabs em Configurações → Provedor de IA para usar.</p>
              ) : null}
            </div>
            {draft.voiceEngine === "gemini" ? (
              <div>
                  <label className="mb-1.5 block text-label-sm text-text-strong-950">Voz</label>
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <Select.Root size="small" value={draft.agentVoice} onValueChange={(value) => set("agentVoice", value)}>
                        <Select.Trigger aria-label="Voz"><Select.Value /></Select.Trigger>
                        <Select.Content>
                          <Select.Item value={DEFAULT_VOICE}>{accentFlag(null)} Padrão ({DEFAULT_AGENT_VOICE})</Select.Item>
                          {AGENT_VOICES.map((voice) => <Select.Item key={voice.id} value={voice.id}>{accentFlag(null)} {AGENT_VOICE_LABELS_PT[voice.id]}</Select.Item>)}
                        </Select.Content>
                      </Select.Root>
                  </div>
                  <VoicePreviewButton voice={draft.agentVoice} name={draft.agentName} />
                </div>
              </div>
            ) : (
              <div>
                <label className="mb-1.5 block text-label-sm text-text-strong-950">Voz da ElevenLabs</label>
                <Select.Root size="small" value={draft.elevenlabsVoice} onValueChange={(value) => set("elevenlabsVoice", value)} disabled={!elevenVoices}>
                  <Select.Trigger aria-label="Voz da ElevenLabs"><Select.Value placeholder={elevenError ?? "Carregando vozes…"} /></Select.Trigger>
                  <Select.Content>
                    {!elevenVoices?.some((voice) => voice.id === DEFAULT_ELEVENLABS_VOICE) ? (
                      <Select.Item value={DEFAULT_ELEVENLABS_VOICE}>{accentFlag("indian")} Monika Sogam (padrão)</Select.Item>
                    ) : null}
                    {(elevenVoices ?? []).map((voice) => (
                      <Select.Item key={voice.id} value={voice.id}>{elevenLabsVoiceLabelPt(voice)}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
                {(() => {
                  const preview = elevenVoices?.find((voice) => voice.id === draft.elevenlabsVoice)?.previewUrl;
                  return preview ? <audio key={preview} controls preload="none" src={preview} className="mt-2 h-9 w-full" aria-label="Prévia da voz" /> : null;
                })()}
                <p className="mt-1 text-paragraph-xs text-text-sub-600">
                  A ElevenLabs responde apenas em inglês. Uma voz recém-escolhida leva cerca de três minutos para ficar pronta após o salvamento; nesse intervalo, as ligações usam Monika Sogam.
                </p>
              </div>
            )}
          </div>
        </FramePanel>
      </Frame>

      {!handover && (
        <Frame>
          <FrameHeader title="Agendamento" description="Onde os leads interessados marcam um horário com sua equipe (uma página do Cal.com) e a mensagem do WhatsApp que os envia logo após a ligação." />
          <FramePanel className="space-y-4">
            <BookingLinkField label="Link de agendamento" value={draft.bookingUrl} onChange={(value) => set("bookingUrl", value)} />
            <div>
              <label htmlFor="ai-booking-message" className="mb-1.5 block text-label-sm text-text-strong-950">Mensagem de agendamento</label>
              <Textarea.Root
                id="ai-booking-message"
                simple
                rows={4}
                maxLength={AI_CAMPAIGN_MAX_BOOKING_MESSAGE}
                value={draft.bookingMessage}
                onChange={(event) => set("bookingMessage", event.target.value)}
                hasError={Boolean(draft.bookingUrl.trim()) && !draft.bookingMessage.includes("{{bookingLink}}")}
              />
              <p className="mt-1 text-paragraph-xs text-text-sub-600">Deve incluir <code className="font-mono">{"{{bookingLink}}"}</code>. Você também pode usar {"{{firstName}}"}, {"{{company}}"} e {"{{agentName}}"}.</p>
            </div>
          </FramePanel>
        </Frame>
      )}

      <Frame>
        <FrameHeader title="Retornos" description="Quando um lead pede para ser chamado depois, o agente liga no horário informado." />
        <FramePanel>
          <label className="mb-1.5 block text-label-sm text-text-strong-950" htmlFor="ai-callbacks">Máximo de retornos por lead</label>
          <Select.Root size="small" value={String(draft.maxCallbacks)} onValueChange={(value) => set("maxCallbacks", Number(value))}>
            <Select.Trigger id="ai-callbacks" className="w-40"><Select.Value /></Select.Trigger>
            <Select.Content>
              {Array.from({ length: AI_CAMPAIGN_MAX_CALLBACKS + 1 }, (_, n) => (
                <Select.Item key={n} value={String(n)}>{n === 0 ? "Nenhum" : n}</Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <p className="mt-1.5 text-paragraph-xs text-text-sub-600">Depois do último, uma pessoa assume o lead.</p>
        </FramePanel>
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-stroke-soft-200 px-5 py-3.5">
          {(problem || error) && dirty && (
            <p role="alert" className="mr-auto flex items-center gap-2 text-paragraph-sm text-error-base">
              <RiErrorWarningLine className="size-4 shrink-0" />{aiErrorPt(error ?? problem ?? "")}
            </p>
          )}
          {dirty && !problem && <span className="text-paragraph-xs text-warning-dark">Alterações não salvas</span>}
          {justSaved && !dirty && <span role="status" className="text-paragraph-xs text-success-base">Salvo</span>}
          {error && !dirty && <p role="alert" className="mr-auto text-paragraph-sm text-error-base">{error}</p>}
          <Button.Root variant="primary" mode="filled" size="small" onClick={() => void save()} disabled={saving || !dirty || Boolean(problem) || nameTooLong}>
            <Button.Icon as={saving ? RiLoader4Line : RiSaveLine} className={cn(saving && "animate-spin")} />
            {saving ? "Salvando…" : "Salvar configurações"}
          </Button.Root>
        </div>
      </Frame>

      <Frame>
        <FrameHeader title="Números para ligações" description="Cada lead recebe ligações e mensagens de um desses números e continua falando com o mesmo." />
        <FramePanel>
          <NumberPicker stations={stations} selectedIds={numberIds} onChange={(ids) => { setNumbersError(null); setNumberIds(ids); }} error={stationsError} />
          {numbersError && <p role="alert" className="mt-3 text-paragraph-sm text-error-base">{numbersError}</p>}
          <div className="mt-4 flex items-center justify-end gap-3">
            {numbersDirty && <span className="text-paragraph-xs text-warning-dark">Alterações não salvas</span>}
            <Button.Root variant="primary" mode="filled" size="small" onClick={() => void saveNumbers()} disabled={savingNumbers || !numbersDirty}>
              <Button.Icon as={savingNumbers ? RiLoader4Line : RiSaveLine} className={cn(savingNumbers && "animate-spin")} />
              {savingNumbers ? "Salvando…" : "Salvar números"}
            </Button.Root>
          </div>
        </FramePanel>
        <FrameFooter>Limites diários, intervalos e horários vêm das Regras de envio da organização, que cada número pode sobrescrever em Configurações → WhatsApp → Números para ligações.</FrameFooter>
      </Frame>

      <Frame>
        <FrameHeader title="Pausar ou arquivar" description="Pausar interrompe novas ligações e mensagens, mantendo os leads na fila. Arquivar remove a campanha da lista." />
        <FramePanel className="flex flex-wrap items-center gap-2">
          {launched && (
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={onToggle} disabled={toggling}>
              <Button.Icon as={toggling ? RiLoader4Line : campaign.state === "active" ? RiPauseCircleLine : RiPlayCircleLine} className={cn(toggling && "animate-spin")} />
              {campaign.state === "active" ? "Pausar campanha" : "Retomar campanha"}
            </Button.Root>
          )}
          <Button.Root variant="error" mode="stroke" size="small" onClick={onArchive}>
            <Button.Icon as={RiArchiveLine} />
            Arquivar campanha
          </Button.Root>
          {!launched && <p className="text-paragraph-xs text-text-sub-600">Esta campanha é um rascunho; lance-a pelo cabeçalho quando estiver pronta.</p>}
        </FramePanel>
      </Frame>
    </div>
  );
}
