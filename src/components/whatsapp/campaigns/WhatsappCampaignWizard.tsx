"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RiArrowLeftLine, RiArrowRightLine, RiCheckLine, RiDraftLine, RiFileExcel2Line, RiLoader4Line, RiRocketLine, RiStackLine, RiTeamLine, RiUserAddLine } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { PageHeader } from "@/components/page/PageHeader";
import type {
  CreateWhatsappCampaignRequest,
  UpdateWhatsappCampaignRequest,
  WhatsappCampaignDetail,
  WhatsappCampaignImportResponse,
  WhatsappCampaignStep,
  WhatsappCampaignSummary,
} from "@/lib/whatsapp/campaigns/contract";
import type { WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { cn } from "@/utils/cn";
import { apiJson, errorText, fetchWhatsappAccounts } from "./api";
import { formatDelay, launchBlocker } from "./metrics";
import { importSummary } from "./WhatsappCampaignLeadsTab";
import { SenderPicker } from "./SenderPicker";
import { WhatsappSequenceEditor } from "./WhatsappSequenceEditor";

const STEPS = [
  { id: "setup", label: "Detalhes e números", hint: "Nome e remetentes", icon: RiDraftLine },
  { id: "leads", label: "Adicionar leads", hint: "Pessoas ou planilha", icon: RiTeamLine },
  { id: "sequence", label: "Escrever mensagens", hint: "Primeira mensagem e follow-ups", icon: RiStackLine },
  { id: "review", label: "Revisar e iniciar", hint: "Confirmar prontidão de envio", icon: RiCheckLine },
] as const;

function StepDot({ index, active, done }: { index: number; active: boolean; done: boolean }) {
  return (
    <div
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg text-label-xs transition",
        done ? "bg-success-lighter text-success-base" : active ? "bg-primary-base text-static-white shadow-regular-xs" : "bg-bg-weak-50 text-text-soft-400",
      )}
    >
      {done ? <RiCheckLine className="size-4" /> : index + 1}
    </div>
  );
}

export function WhatsappCampaignWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[] | null>(null);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [leadCount, setLeadCount] = useState(0);
  const [steps, setSteps] = useState<WhatsappCampaignStep[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importNote, setImportNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWhatsappAccounts()
      .then((list) => { if (!cancelled) setAccounts(list); })
      .catch((cause) => { if (!cancelled) setAccountsError(errorText(cause, "Não foi possível carregar os números")); });
    return () => { cancelled = true; };
  }, []);

  // Review shows what the server holds, not what this page remembers.
  useEffect(() => {
    if (step !== 3 || !campaignId) return;
    let cancelled = false;
    apiJson<WhatsappCampaignDetail>(`/api/whatsapp/campaigns/${campaignId}`)
      .then((detail) => {
        if (cancelled) return;
        setLeadCount(detail.stats.total);
        setSteps(detail.steps);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [step, campaignId]);

  const connectedSelected = useMemo(
    () => (accounts ?? []).filter((a) => accountIds.includes(a.id) && a.status === "connected").length,
    [accounts, accountIds],
  );
  const blocker = launchBlocker({ connectedSenders: connectedSelected, leads: leadCount, firstMessage: steps[0]?.body });
  const writtenSteps = steps.filter((s) => s.body.trim()).length;

  async function saveSetup() {
    if (!name.trim()) { setError("Informe o nome da campanha"); return; }
    setBusy(true);
    setError(null);
    try {
      if (campaignId) {
        const body: UpdateWhatsappCampaignRequest = { name: name.trim(), description: description.trim() || null, accountIds };
        await apiJson(`/api/whatsapp/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        const body: CreateWhatsappCampaignRequest = { name: name.trim(), description: description.trim() || null, accountIds };
        const created = await apiJson<WhatsappCampaignSummary>("/api/whatsapp/campaigns", { method: "POST", body: JSON.stringify(body) });
        setCampaignId(created.id);
      }
      setStep(1);
    } catch (cause) {
      setError(errorText(cause, "Não foi possível salvar a campanha"));
    } finally {
      setBusy(false);
    }
  }

  async function finish(launch: boolean) {
    if (!campaignId) return;
    setBusy(true);
    setError(null);
    try {
      if (launch) {
        const body: UpdateWhatsappCampaignRequest = { status: "active" };
        await apiJson(`/api/whatsapp/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      router.push(`/whatsapp/campaigns/${campaignId}`);
    } catch (cause) {
      setError(errorText(cause, "Não foi possível iniciar a campanha"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/whatsapp/campaigns", label: "Campanhas de mensagens" }}
        title="Criar campanha de mensagens"
        description="Escolha seus números, adicione leads, escreva as mensagens e visualize com dados reais. A campanha fica pausada até você iniciá-la."
      />

      <div className="mt-6 grid grid-cols-1 items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5">
        <Frame>
          <FrameHeader title="Etapas" description={`Etapa ${step + 1} de ${STEPS.length}`} />
          <FramePanel className="p-2 sm:p-2">
            <ol className="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:grid-cols-1">
              {STEPS.map((item, index) => {
                const active = index === step;
                const done = index < step;
                const reachable = index <= step;
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={!reachable || active || busy}
                      onClick={() => setStep(index)}
                      aria-current={active ? "step" : undefined}
                       className={cn("flex w-full items-center gap-3 rounded-xl p-2.5 text-left outline-none transition duration-200 ease-out focus-visible:ring-2 focus-visible:ring-primary-base", active ? "bg-bg-weak-50 ring-1 ring-inset ring-primary-alpha-16" : reachable ? "hover:bg-bg-weak-50" : "cursor-default")}
                    >
                      <StepDot index={index} active={active} done={done} />
                      <span className="min-w-0">
                        <span className={cn("block text-label-sm", active ? "text-text-strong-950" : "text-text-sub-600")}>{item.label}</span>
                        <span className="mt-0.5 hidden text-paragraph-xs text-text-soft-400 lg:block">{item.hint}</span>
                      </span>
                      <Icon className="ml-auto hidden size-4 text-text-soft-400 sm:block lg:hidden" />
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mx-1 mb-1 mt-3 hidden border-t border-stroke-soft-200 px-2 pt-3 lg:block">
              <p className="text-paragraph-xs text-text-sub-600">Resumo</p>
              <dl className="mt-2 space-y-2 text-paragraph-sm">
                <SummaryRow label="Nome" value={name || "Ainda sem nome"} truncate />
                <SummaryRow label="Números" value={accountIds.length.toLocaleString()} />
                <SummaryRow label="Leads" value={leadCount.toLocaleString()} />
                <SummaryRow label="Mensagens" value={String(writtenSteps || steps.length)} />
              </dl>
            </div>
          </FramePanel>
        </Frame>

        <Frame>
          <FramePanel className="min-h-[560px] p-5 sm:p-7">
            {step === 0 && (
              <div className="mx-auto max-w-2xl">
                <StepHeading title="Detalhes da campanha" description="Escolha um nome claro e os números do WhatsApp que poderão enviar mensagens." />
                <div className="mt-6 space-y-5">
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">Nome da campanha</span>
                    <Input.Root hasError={Boolean(error && !name.trim())}>
                      <Input.Wrapper>
                        <Input.Input value={name} onChange={(event) => setName(event.target.value)} placeholder="ex.: Divulgação para founders na Índia" autoFocus />
                      </Input.Wrapper>
                    </Input.Root>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-label-sm text-text-strong-950">Descrição <span className="text-text-sub-600">(opcional)</span></span>
                    <Textarea.Root simple rows={3} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Qual é o objetivo desta campanha?" />
                  </label>
                  <fieldset>
                    <legend className="mb-2 block text-label-sm text-text-strong-950">Números do WhatsApp</legend>
                    <SenderPicker accounts={accounts} selectedIds={accountIds} onChange={setAccountIds} error={accountsError} />
                    <p className="mt-2 text-paragraph-xs text-text-sub-600">Cada lead é contatado por um número e permanece nele. Um número novo aguarda 24 horas antes de iniciar conversas.</p>
                  </fieldset>
                </div>
                <WizardFooter error={error} backLabel="Cancelar" onBack={() => router.push("/whatsapp/campaigns")} onNext={() => void saveSetup()} busy={busy} nextLabel="Continuar para leads" />
              </div>
            )}

            {step === 1 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title="Adicionar leads" description="Importe uma planilha com números de telefone ou selecione pessoas já cadastradas." />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-stroke-sub-300 bg-bg-weak-50 p-6 text-center outline-none transition hover:border-primary-base focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200"><RiFileExcel2Line className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">Importar CSV ou Excel</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">Mapeie a coluna de telefone antes de importar.</span>
                  </button>
                  <button type="button" onClick={() => setShowPeople(true)} className="flex min-h-44 flex-col items-center justify-center rounded-2xl bg-bg-white-0 p-6 text-center shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-bg-weak-50 ring-1 ring-inset ring-stroke-soft-200"><RiUserAddLine className="size-5 text-text-sub-600" /></span>
                    <span className="mt-3 text-label-md text-text-strong-950">Adicionar de Pessoas</span>
                    <span className="mt-1 text-paragraph-xs text-text-sub-600">Selecione pessoas já cadastradas com número de telefone.</span>
                  </button>
                </div>
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
                <div role="status" className="mt-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
                  <p className="text-label-sm text-text-strong-950">{leadCount.toLocaleString()} {leadCount === 1 ? "lead adicionado" : "leads adicionados"}</p>
                  <p className="mt-1 text-paragraph-xs text-text-sub-600">{importNote ?? "Você pode continuar sem leads e adicioná-los depois. A campanha permanece pausada."}</p>
                </div>
                <WizardFooter error={error} onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Continuar para mensagens" />
                {pendingFile && (
                  <CampaignCsvMappingDialog
                    file={pendingFile}
                    endpoint={`/api/whatsapp/campaigns/${campaignId}/upload`}
                    channel="whatsapp"
                    onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                    onImported={(result) => {
                      const imported = result as WhatsappCampaignImportResponse;
                      setLeadCount((current) => current + imported.added);
                      setImportNote(importSummary(imported));
                      setPendingFile(null);
                      if (fileRef.current) fileRef.current.value = "";
                    }}
                  />
                )}
                {showPeople && (
                  <AddPeopleToCampaignModal
                    campaignId={campaignId}
                    channel="whatsapp"
                    onClose={() => setShowPeople(false)}
                    onAdded={(result) => {
                      setLeadCount((current) => current + result.added);
                      setImportNote(`${result.added} adicionados de Pessoas${result.skippedDuplicate ? ` · ${result.skippedDuplicate} já inscritos` : ""}${result.skippedMissingIdentity ? ` · ${result.skippedMissingIdentity} sem número de telefone` : ""}`);
                    }}
                  />
                )}
              </div>
            )}

            {step === 2 && campaignId && (
              <div>
                <StepHeading title="Escreva suas mensagens" description="Uma primeira mensagem e follow-ups opcionais. Personalize com campos de Pessoas e visualize com um lead real." />
                <div className="mt-5">
                  <WhatsappSequenceEditor
                    campaignId={campaignId}
                    initialSteps={steps}
                    leadsVersion={leadCount}
                    saveLabel="Salvar e revisar"
                    onSaved={(next) => { setSteps(next); setStep(3); }}
                  />
                </div>
                <div className="mt-5">
                  <Button.Root variant="neutral" mode="ghost" size="small" onClick={() => setStep(1)}>
                    <Button.Icon as={RiArrowLeftLine} />Voltar aos leads
                  </Button.Root>
                </div>
              </div>
            )}

            {step === 3 && campaignId && (
              <div className="mx-auto max-w-3xl">
                <StepHeading title="Revisar e iniciar" description="Sua campanha permanece pausada até você iniciá-la explicitamente." />
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <SummaryCard label="Campanha" value={name} detail="pausada até o início" />
                  <SummaryCard label="Leads" value={leadCount.toLocaleString()} detail="inscritos" />
                  <SummaryCard label="Números" value={accountIds.length.toLocaleString()} detail={`${connectedSelected} conectados`} />
                </div>
                <div className="mt-4 rounded-2xl bg-bg-weak-50 p-1 ring-1 ring-inset ring-stroke-soft-200">
                  <h3 className="px-3 pb-2 pt-2 text-label-sm text-text-strong-950">Sequência</h3>
                  <ul className="divide-y divide-stroke-soft-200 rounded-xl bg-bg-white-0 px-4 ring-1 ring-inset ring-stroke-soft-200">
                    {steps.map((item, index) => (
                      <li key={item.id} className="flex items-center justify-between gap-4 py-2.5 text-paragraph-sm">
                        <span className="min-w-0">
                          <span className="block text-text-sub-600">{index === 0 ? "Primeira mensagem" : `Follow-up ${index} · após ${formatDelay(item.delayHours)}`}</span>
                          <span className="block max-w-md truncate text-paragraph-xs text-text-sub-600">{item.body}</span>
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-success-base"><RiCheckLine className="size-4" aria-hidden="true" />Pronto</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-paragraph-xs text-text-sub-600">As primeiras mensagens contam para o limite de novas conversas por dia de cada número (Configurações → WhatsApp → Regras de envio). Uma resposta em qualquer canal interrompe a sequência e vai para CRM → Ação necessária.</p>
                {blocker && <p className="mt-4 rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">{blocker} antes de iniciar. Você pode salvar pausada e concluir depois.</p>}
                <WizardFooter error={error} onBack={() => setStep(2)} busy={busy} secondaryLabel="Salvar pausada" onSecondary={() => void finish(false)} nextLabel="Iniciar campanha" onNext={() => void finish(true)} nextDisabled={Boolean(blocker)} nextIcon={RiRocketLine} />
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

function StepHeading({ title, description }: { title: string; description: string }) {
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
      <p className="text-paragraph-xs text-text-sub-600">{detail}</p>
    </div>
  );
}

function WizardFooter({
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
          {secondaryLabel && onSecondary && (
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={onSecondary} disabled={busy}>{secondaryLabel}</Button.Root>
          )}
          <Button.Root variant="primary" mode="filled" size="small" onClick={onNext} disabled={busy || nextDisabled}>
            <Button.Icon as={busy ? RiLoader4Line : NextIcon} className={cn(busy && "animate-spin")} />
            {busy ? "Salvando…" : nextLabel}
          </Button.Root>
        </div>
      </div>
    </div>
  );
}
