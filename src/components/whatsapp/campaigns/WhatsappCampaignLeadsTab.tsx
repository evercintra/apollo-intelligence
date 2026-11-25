"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiChat1Line,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileExcel2Line,
  RiLoader4Line,
  RiMoreLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiStopCircleLine,
  RiTeamLine,
  RiUserAddLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import AddPeopleToCampaignModal from "@/components/leads/AddPeopleToCampaignModal";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";
import { EmptyState } from "@/components/page/EmptyState";
import { Skeleton } from "@/components/page/Skeletons";
import {
  WHATSAPP_CAMPAIGN_LEAD_STATUSES,
  type ListWhatsappCampaignLeadsResponse,
  type UpdateWhatsappCampaignLeadRequest,
  type WhatsappCampaignImportResponse,
  type WhatsappCampaignLead,
  type WhatsappCampaignLeadStatus,
  type WhatsappCampaignStats,
} from "@/lib/whatsapp/campaigns/contract";
import { cn } from "@/utils/cn";
import { apiJson, errorText } from "./api";
import { LEAD_STATUS, relativeTime } from "./metrics";

const PAGE_SIZE = 25;

type StatusFilter = WhatsappCampaignLeadStatus | "all";

/** "Message 2 of 3": how far the sequence has got for this lead. */
function progressLabel(lead: WhatsappCampaignLead, stepCount: number): string {
  if (lead.status === "queued") return `Mensagem 1 de ${stepCount}`;
  if (lead.status === "in_sequence") return `Mensagem ${Math.min(lead.currentStep + 1, stepCount)} de ${stepCount}`;
  return `${lead.currentStep} de ${stepCount} enviadas`;
}

function nextOrLast(lead: WhatsappCampaignLead): string {
  if (lead.status === "queued" || lead.status === "in_sequence") {
    return lead.nextSendAt ? `Próxima ${relativeTime(lead.nextSendAt)}` : "Aguardando um número";
  }
  if (lead.status === "replied") return lead.repliedAt ? `Respondeu ${relativeTime(lead.repliedAt)}` : "Respondeu";
  return lead.lastSentAt ? `Último envio ${relativeTime(lead.lastSentAt)}` : "Nada enviado";
}

/**
 * The Leads tab of a message campaign: import (spreadsheet or People),
 * filter by status and search, and stop, resume or remove a lead. Owns its
 * page of leads and tells the parent when counts may have changed.
 */
export function WhatsappCampaignLeadsTab({
  campaignId,
  stats,
  stepCount,
  onChanged,
}: {
  campaignId: string;
  stats: WhatsappCampaignStats;
  stepCount: number;
  /** Leads were added, removed or changed; the parent reloads the campaign's figures. */
  onChanged: () => void;
}) {
  const dialogs = useDialogs();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListWhatsappCampaignLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebounced(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (status !== "all") params.set("status", status);
    if (debounced) params.set("q", debounced);
    try {
      const result = await apiJson<ListWhatsappCampaignLeadsResponse>(`/api/whatsapp/campaigns/${campaignId}/leads?${params}`);
      setData(result);
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorText(cause, "Não foi possível carregar os leads"));
    } finally {
      setLoading(false);
    }
  }, [campaignId, page, status, debounced]);

  useEffect(() => {
    // Fetch on mount and whenever the query changes; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Counts or the sequence moved on elsewhere (a poll of the detail page): refresh this page too.
  const totalSeen = useRef(stats.total);
  useEffect(() => {
    if (totalSeen.current !== stats.total) {
      totalSeen.current = stats.total;
      void load();
    }
  }, [stats.total, load]);

  const refreshAll = useCallback(() => {
    void load();
    onChanged();
  }, [load, onChanged]);

  async function act(lead: WhatsappCampaignLead, action: UpdateWhatsappCampaignLeadRequest["action"]) {
    setBusyId(lead.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${campaignId}/leads/${lead.id}`, { method: "PATCH", body: JSON.stringify({ action } satisfies UpdateWhatsappCampaignLeadRequest) });
      refreshAll();
    } catch (cause) {
      await dialogs.alert({ title: action === "stop" ? "Não foi possível interromper o lead" : "Não foi possível retomar o lead", description: errorText(cause), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function remove(lead: WhatsappCampaignLead) {
    const ok = await dialogs.confirm({
      title: "Remover lead?",
      description: `${lead.name || lead.phone} sai desta campanha e não receberá mais mensagens. As mensagens já enviadas permanecem em Mensagens e no CRM.`,
      confirmLabel: "Remover lead",
      variant: "error",
    });
    if (!ok) return;
    setBusyId(lead.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${campaignId}/leads/${lead.id}`, { method: "DELETE" });
      refreshAll();
    } catch (cause) {
      await dialogs.alert({ title: "Não foi possível remover o lead", description: errorText(cause), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtering = status !== "all" || debounced.length > 0;
  const openStatuses = new Set<WhatsappCampaignLeadStatus>(["queued", "in_sequence"]);

  const importActions = (
    <>
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => fileRef.current?.click()}>
        <Button.Icon as={RiFileExcel2Line} />
        Importar planilha
      </Button.Root>
      <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => setShowPeople(true)}>
        <Button.Icon as={RiUserAddLine} />
        Adicionar de Pessoas
      </Button.Root>
    </>
  );

  return (
    <Frame>
      <FrameHeader
        title="Leads"
        description="Todos os leads inscritos nesta campanha e sua posição na sequência."
        actions={<div className="flex flex-wrap items-center gap-2">{importActions}</div>}
      />
      <FramePanel className="p-2 sm:p-2">
        <div className="flex flex-col gap-2 p-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <SegmentedControl.Root value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
              <SegmentedControl.List className="w-auto">
                <SegmentedControl.Trigger value="all" className="gap-1.5 px-3">
                  Todos <span className="tabular-nums text-text-sub-600">{stats.total}</span>
                </SegmentedControl.Trigger>
                {WHATSAPP_CAMPAIGN_LEAD_STATUSES.map((s) => (
                  <SegmentedControl.Trigger key={s} value={s} className="gap-1.5 px-3">
                    {LEAD_STATUS[s].label} <span className="tabular-nums text-text-sub-600">{stats[s]}</span>
                  </SegmentedControl.Trigger>
                ))}
              </SegmentedControl.List>
            </SegmentedControl.Root>
          </div>
          <Input.Root size="small" className="w-full lg:w-64">
            <Input.Wrapper>
              <Input.Icon as={RiSearchLine} />
              <Input.Input type="search" aria-label="Buscar leads" placeholder="Buscar nome, telefone, empresa…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </Input.Wrapper>
          </Input.Root>
        </div>

        {notice && (
          <p role="status" className="mx-2 mb-2 rounded-xl bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">{notice}</p>
        )}

        <div className="overflow-x-auto">
          {loading ? (
            <div aria-busy="true" aria-label="Carregando" className="space-y-2 p-2">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}
            </div>
          ) : loadError ? (
            <EmptyState icon={RiErrorWarningLine} title="Não foi possível carregar os leads" description={loadError} action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setLoading(true); void load(); }}>Tentar novamente</Button.Root>} />
          ) : !data || data.leads.length === 0 ? (
            filtering ? (
              <EmptyState icon={RiSearchLine} title="Nenhum lead encontrado" description="Tente outro status ou busca." action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setSearch(""); setStatus("all"); }}>Limpar filtros</Button.Root>} />
            ) : (
              <EmptyState
                icon={RiTeamLine}
                title="Nenhum lead ainda"
                description="Importe uma planilha com números de telefone ou adicione pessoas da sua base de leads."
                action={<div className="flex flex-wrap justify-center gap-2">{importActions}</div>}
              />
            )
          ) : (
            <Table.Root className="min-w-[860px] [&>table]:table-fixed">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">Lead</Table.Head>
                  <Table.Head scope="col" className="w-40 px-4">Telefone</Table.Head>
                  <Table.Head scope="col" className="w-32 px-4">Status</Table.Head>
                  <Table.Head scope="col" className="w-36 px-4">Progresso</Table.Head>
                  <Table.Head scope="col" className="w-44 px-4">Quando</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Ações</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {data.leads.map((lead) => {
                  const meta = LEAD_STATUS[lead.status];
                  const busy = busyId === lead.id;
                  return (
                    <Table.Row key={lead.id} aria-busy={busy || undefined} className={cn(busy && "pointer-events-none opacity-60")}>
                      <Table.Cell className="px-4">
                        <p className="truncate text-label-sm text-text-strong-950" title={lead.name ?? undefined}>{lead.name || "Sem nome"}</p>
                        <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600">{[lead.title, lead.companyName].filter(Boolean).join(" · ") || "—"}</p>
                      </Table.Cell>
                      <Table.Cell className="px-4 text-paragraph-sm tabular-nums text-text-sub-600">{lead.phone}</Table.Cell>
                      <Table.Cell className="px-4">
                        <Badge.Root size="small" variant="lighter" color={meta.color}>
                          <Badge.Dot />
                          {meta.label}
                        </Badge.Root>
                      </Table.Cell>
                      <Table.Cell className="px-4 text-paragraph-sm tabular-nums text-text-sub-600">{progressLabel(lead, stepCount)}</Table.Cell>
                      <Table.Cell className="px-4">
                        <p className="text-paragraph-sm text-text-sub-600" suppressHydrationWarning>{nextOrLast(lead)}</p>
                        {lead.status === "failed" && lead.lastError && (
                          <p className="mt-0.5 line-clamp-2 text-paragraph-xs text-error-base" title={lead.lastError}>{lead.lastError}</p>
                        )}
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <div className="flex justify-end">
                          <Dropdown.Root>
                            <Dropdown.Trigger asChild>
                              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={`Mais ações para ${lead.name || lead.phone}`}>
                                <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
                              </Button.Root>
                            </Dropdown.Trigger>
                            <Dropdown.Content>
                              {openStatuses.has(lead.status) && (
                                <Dropdown.Item onSelect={() => void act(lead, "stop")}>
                                  <Dropdown.ItemIcon as={RiStopCircleLine} />
                                  Interromper sequência
                                </Dropdown.Item>
                              )}
                              {(lead.status === "stopped" || lead.status === "failed") && (
                                <Dropdown.Item onSelect={() => void act(lead, "resume")}>
                                  <Dropdown.ItemIcon as={RiPlayCircleLine} />
                                  Retomar sequência
                                </Dropdown.Item>
                              )}
                              {lead.chatId && (
                                <Dropdown.Item onSelect={() => router.push(`/calling/messages?chat=${encodeURIComponent(lead.chatId!)}`)}>
                                  <Dropdown.ItemIcon as={RiChat1Line} />
                                  Abrir conversa
                                  <Dropdown.ItemIcon as={RiExternalLinkLine} className="ml-auto" />
                                </Dropdown.Item>
                              )}
                              <Dropdown.Separator />
                              <Dropdown.Item destructive onSelect={() => void remove(lead)}>
                                <Dropdown.ItemIcon as={RiDeleteBinLine} />
                                Remover da campanha
                              </Dropdown.Item>
                            </Dropdown.Content>
                          </Dropdown.Root>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </div>

        {data && data.total > data.pageSize && (
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-3">
            <p className="text-paragraph-xs tabular-nums text-text-sub-600">
              {((data.page - 1) * data.pageSize + 1).toLocaleString("pt-BR")}–{Math.min(data.page * data.pageSize, data.total).toLocaleString("pt-BR")} de {data.total.toLocaleString("pt-BR")}
            </p>
            <div className="flex items-center gap-1">
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={data.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior">
                <Button.Icon as={RiArrowLeftSLine} />
              </Button.Root>
              <span className="px-2 text-paragraph-xs tabular-nums text-text-sub-600">Página {data.page} de {pages}</span>
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={data.page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima página">
                <Button.Icon as={RiArrowRightSLine} />
              </Button.Root>
            </div>
          </div>
        )}
      </FramePanel>

      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
      {pendingFile && (
        <CampaignCsvMappingDialog
          file={pendingFile}
          endpoint={`/api/whatsapp/campaigns/${campaignId}/upload`}
          channel="whatsapp"
          onClose={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = ""; }}
          onImported={(result) => {
            const imported = result as WhatsappCampaignImportResponse;
            setNotice(importSummary(imported));
            setPendingFile(null);
            if (fileRef.current) fileRef.current.value = "";
            refreshAll();
          }}
        />
      )}
      {showPeople && (
        <AddPeopleToCampaignModal
          campaignId={campaignId}
          channel="whatsapp"
          onClose={() => setShowPeople(false)}
          onAdded={(result) => {
            setNotice(`${result.added} adicionados de Pessoas${result.skippedDuplicate ? ` · ${result.skippedDuplicate} já estão na campanha` : ""}${result.skippedMissingIdentity ? ` · ${result.skippedMissingIdentity} sem número de telefone` : ""}`);
            refreshAll();
          }}
        />
      )}
    </Frame>
  );
}

export function importSummary(result: WhatsappCampaignImportResponse): string {
  const parts = [`${result.added.toLocaleString("pt-BR")} adicionados`];
  if (result.alreadyInCampaign) parts.push(`${result.alreadyInCampaign.toLocaleString("pt-BR")} já estavam na campanha`);
  if (result.skipped.length) parts.push(`${result.skipped.length} ignorados (${result.skipped[0]}${result.skipped.length > 1 ? ", …" : ""})`);
  return parts.join(" · ");
}
