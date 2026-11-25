"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiCheckLine,
  RiDraftLine,
  RiFileExcel2Line,
  RiLoader4Line,
  RiRocketLine,
  RiSmartphoneLine,
  RiStackLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import { VoicePreviewButton } from "@/components/calls/VoicePreviewButton";
import { BookingLinkField } from "./BookingLinkField";
import { KnowledgePicker } from "./KnowledgePicker";
import * as Input from "@/components/alignui/input";
import * as Select from "@/components/alignui/select";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { TextField } from "@/components/calls/fields";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { PageHeader } from "@/components/page/PageHeader";
import { formatDelay } from "@/components/whatsapp/campaigns/metrics";
import {
  AI_CAMPAIGN_MAX_INSTRUCTIONS,
  aiLaunchBlocker,
  aiSequencesError,
  aiSettingsError,
  type AiCampaignDetail,
  type AiLeadsImportResponse,
} from "@/lib/calls/aiCampaigns/api";
import {
  aiLeadsEndpoint,
  aiLeadsUploadEndpoint,
  createAiCampaign,
  getAiCampaign,
  launchAiCampaign,
  setAiCampaignStations,
  updateAiCampaign,
} from "@/lib/calls/aiCampaigns/client";
import { AI_CAMPAIGN_GOALS, type AiCampaignGoal, type AiCampaignStep } from "@/lib/calls/aiCampaigns/contract";
import { listCallingStations } from "@/lib/calls/client";
import { AGENT_VOICES, DEFAULT_AGENT_NAME, DEFAULT_AGENT_VOICE, MAX_AGENT_NAME_CHARS, type AgentVoiceId } from "@/lib/calls/contract";
import type { CallingStation } from "@/lib/calls/stationContract";
import { cn } from "@/utils/cn";
import { AGENT_VOICE_LABELS_PT, AI_GOAL_TEXT_PT, aiErrorPt, errorText, NumberPicker } from "./aiShared";
import { importSummary } from "./AiLeadsTab";
import { AiStepsEditor } from "./AiStepsEditor";

const STEPS = [
  { id: "goal", label: "Nome e objetivo", hint: "Para que servem as ligações", icon: RiDraftLine },
  { id: "numbers", label: "Números", hint: "De onde vêm as ligações", icon: RiSmartphoneLine },
  { id: "leads", label: "Leads", hint: "Pessoas ou planilha", icon: RiTeamLine },
  { id: "sequence", label: "Roteiro e sequência", hint: "Instruções e etapas", icon: RiStackLine },
  { id: "review", label: "Revisar e lançar", hint: "Confirmar a prontidão", icon: RiCheckLine },
] as const;

const DEFAULT_VOICE = "default";

export function AiCampaignWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [campaign, setCampaign] = useState<AiCampaignDetail | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goal, setGoal] = useState<AiCampaignGoal>("book_meeting");
  const [stations, setStations] = useState<CallingStation[] | null>(null);
  const [stationsError, setStationsError] = useState<string | null>(null);
  const [numberIds, setNumberIds] = useState<string[]>([]);
  const [leadCount, setLeadCount] = useState(0);
  const [importNote, setImportNote] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [knowledgeIds, setKnowledgeIds] = useState<string[] | null>(null);
  const [agentName, setAgentName] = useState("");
  const [agentVoice, setAgentVoice] = useState(DEFAULT_VOICE);
  const [bookingUrl, setBookingUrl] = useState("");
  const [bookingMessage, setBookingMessage] = useState("");
  const [steps, setSteps] = useState<AiCampaignStep[]>([]);
  const [chaseSteps, setChaseSteps] = useState<AiCampaignStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCallingStations()
      .then((response) => { if (!cancelled) setStations(response.stations); })
      .catch((cause) => { if (!cancelled) setStationsError(aiErrorPt(errorText(cause, "Não foi possível carregar os números"))); });
    return () => { cancelled = true; };
  }, []);

  const campaignId = campaign?.id ?? null;

  // Review shows what the server holds, not what this page remembers.
  useEffect(() => {
    if (step !== 4 || !campaignId) return;
    let cancelled = false;
    getAiCampaign(campaignId)
      .then((detail) => { if (!cancelled) { setCampaign(detail); setLeadCount(detail.leads); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, campaignId]);

  const handover = goal === "human_callback";
  const blocker = campaign
    ? aiLaunchBlocker({ numbers: campaign.numbers.length, steps: campaign.steps, instructions: campaign.instructions, goal: campaign.goal, bookingUrl: campaign.bookingUrl, leads: campaign.leads })
    : "Salve os detalhes primeiro";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(aiErrorPt(errorText(cause)));
    } finally {
      setBusy(false);
    }
  }

  const saveGoal = () => run(async () => {
    if (!name.trim()) throw new Error("Informe o nome da campanha");
    if (campaign) {
      setCampaign(await updateAiCampaign(campaign.id, { name: name.trim(), description: description.trim() || null, goal }));
    } else {
      const created = await createAiCampaign({ name: name.trim(), description: description.trim() || null });
      const withGoal = goal === created.goal ? created : await updateAiCampaign(created.id, { goal });
      setCampaign(withGoal);
      setInstructions(withGoal.instructions);
      setKnowledgeIds(withGoal.knowledgeIds);
      setBookingMessage(withGoal.bookingMessage);
      setSteps(withGoal.steps.map((s) => ({ ...s })));
      setChaseSteps(withGoal.chaseSteps.map((s) => ({ ...s })));
    }
    setStep(1);
  });

  const saveNumbers = () => run(async () => {
    if (!campaign) return;
    setCampaign(await setAiCampaignStations(campaign.id, numberIds));
    setStep(2);
  });

  const sequenceProblem =
    aiSettingsError({ goal, instructions, bookingUrl: handover ? null : bookingUrl.trim() || null, bookingMessage, maxCallbacks: campaign?.maxCallbacks ?? 2 }) ??
    aiSequencesError(steps, handover ? [] : chaseSteps);

  const saveSequence = () => run(async () => {
    if (!campaign) return;
    if (sequenceProblem) throw new Error(aiErrorPt(sequenceProblem));
    setCampaign(
      await updateAiCampaign(campaign.id, {
        instructions,
        knowledgeIds,
        agentName: agentName.trim() || null,
        agentVoice: agentVoice === DEFAULT_VOICE ? null : agentVoice,
        bookingUrl: handover ? null : bookingUrl.trim() || null,
        bookingMessage,
        steps,
        chaseSteps,
      }),
    );
    setStep(4);
  });

  const finish = (launch: boolean) => run(async () => {
    if (!campaign) return;
    if (launch) await launchAiCampaign(campaign.id);
    router.push(`/calling/campaigns/ai/${campaign.id}`);
  });

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/calling/campaigns", label: "Campanhas de chamadas" }}
        title="Nova campanha de chamadas com IA"
        description="O agente de IA liga para seus leads a partir dos seus números, faz follow-up pelo WhatsApp e encaminha as pessoas interessadas. Ela permanece como rascunho até você lançá-la."
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
        <Frame>
          <FrameHeader title="Etapas" description={`Etapa ${step + 1} de ${STEPS.length}`} />
          <FramePanel className="p-2 sm:p-2">
            <ol className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">
              {STEPS.map((item, index) => {
                const active = index === step;
                const reachable = index <= step && (index === 0 || campaign !== null);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!reachable || active || busy}
                      onClick={() => setStep(index)}
                      aria-current={active ? "step" : undefined}
                      className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition duration-200 ease-out", active ? "bg-bg-weak-50" : reachable ? "hover:bg-bg-weak-50" : "cursor-default")}
                    >
                      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg text-label-xs transition", index < step ? "bg-success-lighter text-success-base" : active ? "bg-primary-base text-static-white shadow-regular-xs" : "bg-bg-weak-50 text-text-soft-400")}>
                        {index < step ? <RiCheckLine className="size-4" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className={cn("block text-label-sm", active ? "text-text-strong-950" : "text-text-sub-600")}>{item.label}</span>
                        <span className="mt-0.5 hidden text-paragraph-xs text-text-soft-400 lg:block">{item.hint}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="mx-1 mb-1 mt-3 hidden border-t border-stroke-soft-200 px-2 pt-3 lg:block">
              <p className="text-paragraph-xs text-text-soft-400">Resumo</p>
              <dl className="mt-2 space-y-2 text-paragraph-sm">
                <SummaryRow label="Nome" value={name || "Ainda sem nome"} truncate />
                <SummaryRow label="Objetivo" value={AI_GOAL_TEXT_PT[goal].label} truncate />
                <SummaryRow label="Números" value={numberIds.length.toLocaleString("pt-BR")} />
                <SummaryRow label="Leads" value={leadCount.toLocaleString("pt-BR")} />
                <SummaryRow label="Etapas" value={String(steps.length)} />
              </dl>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="min-h-[560px] p-5 sm:p-7">
            {step === 0 && (
              <div className="mx-auto max-w-2xl">
                <Heading title="Nome e objetivo" description="Dê um nome à campanha e diga para que servem as ligações." />
                <div className="mt-6 space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">Nome da campanha</span>
                    <Input.Root hasError={Boolean(error && !name.trim())}>
                      <Input.Wrapper>
                        <Input.Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ex.: fundadores D2C, Índia" autoFocus />
                      </Input.Wrapper>
                    </Input.Root>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">Descrição <span className="text-text-soft-400">(opcional)</span></span>
                    <Textarea.Root simple rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Qual é a finalidade desta campanha?" />
                  </label>
                  <fieldset>
                    <legend className="mb-2 block text-label-sm text-text-strong-950">Objetivo</legend>
                    <div role="radiogroup" aria-label="Objetivo" className="grid gap-2">
                      {AI_CAMPAIGN_GOALS.map((value) => {
                        const active = goal === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setGoal(value)}
                            className={cn("rounded-xl p-3.5 text-left outline-none ring-1 ring-inset transition focus-visible:ring-2 focus-visible:ring-primary-base", active ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200 hover:bg-bg-weak-50")}
                          >
                            <span className="block text-label-sm text-text-strong-950">{AI_GOAL_TEXT_PT[value].label}</span>
                            <span className="mt-1 block text-paragraph-xs text-text-sub-600">{AI_GOAL_TEXT_PT[value].help}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                </div>
                <Footer error={error} backLabel="Cancelar" onBack={() => router.push("/calling/campaigns")} onNext={() => void saveGoal()} busy={busy} nextLabel="Continuar para números" />
              </div>
            )}

            {step === 1 && campaign && (
              <div className="mx-auto max-w-3xl">
                <Heading title="Números para ligações" description="Escolha os números usados pela campanha. Cada lead recebe ligações e mensagens de um deles e continua falando com o mesmo." />
                <div className="mt-6">
                  <NumberPicker stations={stations} selectedIds={numberIds} onChange={setNumberIds} error={stationsError} />
                  <p className="mt-3 text-paragraph-xs text-text-sub-600">Um número novo é aquecido gradualmente, e cada um tem seu limite diário e horário de ligações (Configurações → WhatsApp → Números para ligações e Regras de envio). Você pode lançar com um número ainda sendo vinculado, mas nenhuma ligação sai até a vinculação.</p>
                </div>
                <Footer error={error} onBack={() => setStep(0)} onNext={() => void saveNumbers()} busy={busy} nextLabel="Continuar para leads" />
              </div>
            )}

            {step === 2 && campaign && (
              <div className="mx-auto max-w-3xl">
                <Heading title="Adicionar leads" description="Importe uma planilha com números de telefone ou selecione pessoas da sua base." />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-stroke-sub-300 bg-bg-weak-50 p-6 text-center outline-none transition hover:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200"><RiFileExcel2Line className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">Importar CSV ou Excel</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">Você mapeia a coluna do telefone antes de importar qualquer coisa.</span>
                  </button>
                  <button type="button" onClick={() => setShowPeople(true)} className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-bg-white-0 p-6 text-center shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200"><RiUserAddLine className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">Adicionar de Pessoas</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">Selecione pessoas da base que já tenham número de telefone.</span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
                <div role="status" className="mt-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
                  <p className="text-label-sm text-text-strong-950">{leadCount.toLocaleString("pt-BR")} {leadCount === 1 ? "lead adicionado" : "leads adicionados"}</p>
                  <p className="mt-1 text-paragraph-xs text-text-sub-600">{importNote ?? "Você pode continuar sem leads e adicioná-los depois; a campanha não pode ser lançada até ter pelo menos um."}</p>
                </div>
                <Footer error={error} onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Continuar para o roteiro" />
                {pendingFile && (
                  <CampaignCsvMappingDialog
                    file={pendingFile}
                    endpoint={aiLeadsUploadEndpoint(campaign.id)}
                    channel="whatsapp"
                    onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    onImported={(result) => {
                      const imported = result as AiLeadsImportResponse;
                      setLeadCount((current) => current + imported.added);
                      setImportNote(importSummary(imported));
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                )}
                {showPeople && (
                  <AddPeopleToCampaignModal
                    campaignId={campaign.id}
                    channel="whatsapp"
                    endpoint={aiLeadsEndpoint(campaign.id)}
                    onClose={() => setShowPeople(false)}
                    onAdded={(result) => {
                      setLeadCount((current) => current + result.added);
                      setImportNote(`${result.added} ${result.added === 1 ? "adicionado" : "adicionados"} de Pessoas${result.skippedDuplicate ? ` · ${result.skippedDuplicate} ${result.skippedDuplicate === 1 ? "já estava" : "já estavam"} na campanha` : ""}${result.skippedMissingIdentity ? ` · ${result.skippedMissingIdentity} sem número de telefone` : ""}`);
                    }}
                  />
                )}
              </div>
            )}

            {step === 3 && campaign && (
              <div>
                <Heading title="Roteiro e sequência" description="Sobre o que cada ligação vai falar, quem é o agente e quais ligações e mensagens enviar. Os valores padrão são um bom começo." />
                <div className="mt-6 grid gap-6">
                  <div>
                    <label className="mb-1.5 block text-label-sm text-text-strong-950">Conhecimento</label>
                    <KnowledgePicker value={knowledgeIds} onChange={setKnowledgeIds} />
                  </div>
                  <div>
                    <label htmlFor="wiz-instructions" className="mb-1.5 block text-label-sm text-text-strong-950">Instruções da campanha</label>
                    <p className="mb-2 text-paragraph-xs text-text-sub-600">Sobre o que cada ligação vai falar, além do Conhecimento acima: para quem você está ligando, o que oferece e o que precisa descobrir.</p>
                    <Textarea.Root id="wiz-instructions" simple rows={6} maxLength={AI_CAMPAIGN_MAX_INSTRUCTIONS} value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Você está ligando para fundadores de marcas D2C que anunciam no Meta. Ajudamos eles a …" hasError={!instructions.trim()} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Nome do agente" value={agentName} onChange={setAgentName} placeholder={DEFAULT_AGENT_NAME} maxLength={MAX_AGENT_NAME_CHARS + 10} />
                    <div>
                      <label className="mb-1.5 block text-label-sm text-text-strong-950">Voz</label>
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <Select.Root size="small" value={agentVoice} onValueChange={setAgentVoice}>
                            <Select.Trigger aria-label="Voz"><Select.Value /></Select.Trigger>
                            <Select.Content>
                              <Select.Item value={DEFAULT_VOICE}>Padrão ({DEFAULT_AGENT_VOICE})</Select.Item>
                              {AGENT_VOICES.map((voice) => <Select.Item key={voice.id} value={voice.id}>{AGENT_VOICE_LABELS_PT[voice.id]}</Select.Item>)}
                            </Select.Content>
                          </Select.Root>
                        </div>
                        <VoicePreviewButton voice={agentVoice} name={agentName} />
                      </div>
                    </div>
                  </div>
                  {!handover && (
                    <div className="space-y-3">
                      <BookingLinkField label="Link de agendamento (Cal.com)" value={bookingUrl} onChange={setBookingUrl} />
                      <div>
                        <label htmlFor="wiz-booking-message" className="mb-1.5 block text-label-sm text-text-strong-950">Mensagem de agendamento</label>
                        <Textarea.Root id="wiz-booking-message" simple rows={3} value={bookingMessage} onChange={(event) => setBookingMessage(event.target.value)} hasError={Boolean(bookingUrl.trim()) && !bookingMessage.includes("{{bookingLink}}")} />
                        <p className="mt-1 text-paragraph-xs text-text-sub-600">A mensagem enviada pelo WhatsApp logo após a pessoa aceitar agendar. Deve incluir <code className="font-mono">{"{{bookingLink}}"}</code>.</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <h3 className="mb-3 text-label-md text-text-strong-950">Abordar</h3>
                    <AiStepsEditor steps={steps} onChange={setSteps} campaignId={campaign.id} agentName={agentName.trim() || null} agentVoice={agentVoice === DEFAULT_VOICE ? null : agentVoice} statsPhase="reach" emptyText="Adicione pelo menos uma ligação." />
                  </div>
                  {!handover && (
                    <div>
                      <h3 className="text-label-md text-text-strong-950">Se disseram que sim mas não agendaram</h3>
                      <p className="mb-3 mt-1 text-paragraph-xs text-text-sub-600">Começa depois da mensagem de agendamento e segue até a pessoa agendar, responder ou as etapas terminarem e alguém assumir.</p>
                      <AiStepsEditor steps={chaseSteps} onChange={setChaseSteps} allowEmpty campaignId={campaign.id} agentName={agentName.trim() || null} agentVoice={agentVoice === DEFAULT_VOICE ? null : agentVoice} statsPhase="chase" emptyText="Nenhum follow-up." />
                    </div>
                  )}
                </div>
                <Footer error={error} onBack={() => setStep(2)} onNext={() => void saveSequence()} busy={busy} nextDisabled={Boolean(sequenceProblem)} nextLabel="Salvar e revisar" />
                {sequenceProblem && <p className="mt-2 text-right text-paragraph-xs text-error-base">{aiErrorPt(sequenceProblem)}</p>}
              </div>
            )}

            {step === 4 && campaign && (
              <div className="mx-auto max-w-3xl">
                <Heading title="Revisar e lançar" description="Nenhuma ligação acontece até você lançar. Você pode salvar como rascunho e terminar depois." />
                <div className="mt-6 grid gap-3 sm:grid-cols-4">
                  <SummaryCard label="Campanha" value={campaign.name} detail={AI_GOAL_TEXT_PT[campaign.goal].label} />
                  <SummaryCard label="Leads" value={campaign.leads.toLocaleString("pt-BR")} detail="na fila para ligar" />
                  <SummaryCard label="Números" value={campaign.numbers.length.toLocaleString("pt-BR")} detail={`${campaign.numbers.filter((n) => n.status === "active").length} ${campaign.numbers.filter((n) => n.status === "active").length === 1 ? "ativa" : "ativas"}`} />
                  <SummaryCard label="Agente" value={campaign.agentName || DEFAULT_AGENT_NAME} detail={AGENT_VOICE_LABELS_PT[(campaign.agentVoice ?? DEFAULT_AGENT_VOICE) as AgentVoiceId] ?? campaign.agentVoice ?? DEFAULT_AGENT_VOICE} />
                </div>
                <div className="mt-4 rounded-2xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200">
                  <h3 className="px-3 pb-2 pt-2 text-label-sm text-text-strong-950">Sequência</h3>
                  <ul className="divide-y divide-stroke-soft-200 rounded-xl bg-bg-white-0 px-4 ring-1 ring-inset ring-stroke-soft-200">
                    {campaign.steps.map((item, index) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-paragraph-sm">
                        <span className="min-w-0">
                          <span className="block text-text-sub-600">{item.kind === "call" ? "Ligação com IA" : "Mensagem pelo WhatsApp"}{index > 0 ? ` · depois de ${formatDelay(item.delayHours)}` : " · primeira"}</span>
                          <span className="block max-w-md truncate text-paragraph-xs text-text-soft-400">{item.kind === "call" ? item.instructions || "Sem instruções extras" : item.body}</span>
                        </span>
                        <RiCheckLine className="size-4 shrink-0 text-success-base" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                  {campaign.goal !== "human_callback" && campaign.chaseSteps.length > 0 && (
                    <p className="px-3 py-2 text-paragraph-xs text-text-sub-600">Depois, {campaign.chaseSteps.length} {campaign.chaseSteps.length === 1 ? "etapa de follow-up" : "etapas de follow-up"} para leads que dizem que sim mas não agendam.</p>
                  )}
                </div>
                <p className="mt-4 text-paragraph-xs text-text-sub-600">As ligações começam dentro do horário dos números, com intervalos e limite diário. Uma resposta em qualquer canal interrompe a sequência e vai para CRM → Ação necessária.</p>
                {blocker && <p className="mt-4 rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">{aiErrorPt(blocker)} antes de lançar. Você pode salvar como rascunho e terminar depois.</p>}
                <Footer error={error} onBack={() => setStep(3)} busy={busy} secondaryLabel="Salvar como rascunho" onSecondary={() => void finish(false)} nextLabel="Lançar campanha" onNext={() => void finish(true)} nextDisabled={Boolean(blocker)} nextIcon={RiRocketLine} />
              </div>
            )}
          </FramePanel>
        </Frame>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-text-sub-600">{label}</dt>
      <dd className={cn("text-label-sm tabular-nums text-text-strong-950", truncate && "min-w-0 truncate")}>{value}</dd>
    </div>
  );
}

function Heading({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-label-lg text-text-strong-950">{title}</h2>
      <p className="mt-1 text-paragraph-sm text-text-sub-600">{description}</p>
    </div>
  );
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl bg-bg-white-0 p-4 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200">
      <p className="text-paragraph-xs text-text-sub-600">{label}</p>
      <p className="mt-1 truncate text-label-lg text-text-strong-950" title={value}>{value}</p>
      <p className="truncate text-paragraph-xs text-text-sub-600">{detail}</p>
    </div>
  );
}

function Footer({
  error,
  onBack,
  onNext,
  busy,
  backLabel = "Voltar",
  nextLabel,
  nextDisabled,
  secondaryLabel,
  onSecondary,
  nextIcon: NextIcon = RiArrowRightLine,
}: {
  error?: string | null;
  onBack: () => void;
  onNext: () => void;
  busy?: boolean;
  backLabel?: string;
  nextLabel: string;
  nextDisabled?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
  nextIcon?: typeof RiArrowRightLine;
}) {
  return (
    <div className="mt-8 border-t border-stroke-soft-200 pt-5">
      {error && <p role="alert" className="mb-3 text-paragraph-sm text-error-base">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button.Root variant="neutral" mode="ghost" size="small" onClick={onBack} disabled={busy}>
          <Button.Icon as={RiArrowLeftLine} />{backLabel}
        </Button.Root>
        <div className="flex gap-2">
          {secondaryLabel && onSecondary && <Button.Root variant="neutral" mode="stroke" size="small" onClick={onSecondary} disabled={busy}>{secondaryLabel}</Button.Root>}
          <Button.Root variant="primary" mode="filled" size="small" onClick={onNext} disabled={busy || nextDisabled}>
            <Button.Icon as={busy ? RiLoader4Line : NextIcon} className={cn(busy && "animate-spin")} />
            {busy ? "Salvando…" : nextLabel}
          </Button.Root>
        </div>
      </div>
    </div>
  );
}
