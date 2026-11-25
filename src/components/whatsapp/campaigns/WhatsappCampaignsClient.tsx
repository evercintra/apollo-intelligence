"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiChat1Line,
  RiDeleteBinLine,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPencilLine,
  RiPercentLine,
  RiPlayCircleLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiTeamLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META, formatCompact, formatPercent } from "@/components/analytics/theme";
import { useDialogs } from "@/components/DialogProvider";
import CampaignProgressRing from "@/components/outreach/CampaignProgressRing";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { Skeleton } from "@/components/page/Skeletons";
import type { ListWhatsappCampaignsResponse, WhatsappCampaignSummary } from "@/lib/whatsapp/campaigns/contract";
import { cn } from "@/utils/cn";
import { apiJson, errorText } from "./api";
import { EditWhatsappCampaignModal } from "./EditWhatsappCampaignModal";
import { CAMPAIGN_STATUS, campaignFunnel } from "./metrics";

const WHATSAPP = CHANNEL_META.whatsapp.color;

const FILTERS = ["all", "active", "paused"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { all: "Todas", active: "Ativas", paused: "Pausadas" };

const num = "text-paragraph-sm tabular-nums text-text-strong-950";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
}

function senderLabel(c: WhatsappCampaignSummary): string {
  if (c.senders.length === 0) return "Sem números";
  const first = c.senders[0]!;
  const name = first.name || first.phone || "Número";
  return c.senders.length === 1 ? name : `${name} +${c.senders.length - 1}`;
}

function RowMenu({ campaign, busy, onToggle, onDelete, onEdit }: { campaign: WhatsappCampaignSummary; busy: boolean; onToggle: () => void; onDelete: () => void; onEdit: () => void }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={`Mais ações para ${campaign.name}`}>
          <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
        </Button.Root>
      </Dropdown.Trigger>
      <Dropdown.Content>
        <Dropdown.Item onSelect={onEdit}>
          <Dropdown.ItemIcon as={RiPencilLine} />
          Editar campanha
        </Dropdown.Item>
        <Dropdown.Item onSelect={onToggle}>
          <Dropdown.ItemIcon as={campaign.status === "active" ? RiPauseCircleLine : RiPlayCircleLine} />
          {campaign.status === "active" ? "Pausar campanha" : "Retomar campanha"}
        </Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item destructive onSelect={onDelete}>
          <Dropdown.ItemIcon as={RiDeleteBinLine} />
          Arquivar campanha
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

const NewCampaignButton = () => (
  <Button.Root variant="primary" mode="filled" size="small" asChild>
    <Link href="/whatsapp/campaigns/new">
      <Button.Icon as={RiAddLine} />
      Nova campanha
    </Link>
  </Button.Root>
);

export function WhatsappCampaignsClient() {
  const dialogs = useDialogs();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<WhatsappCampaignSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WhatsappCampaignSummary | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      const data = await apiJson<ListWhatsappCampaignsResponse>("/api/whatsapp/campaigns");
      setCampaigns(data.campaigns);
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorText(cause, "Não foi possível carregar as campanhas"));
    }
  }, []);

  useEffect(() => {
    // Fetch on mount and whenever the query changes; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const rows = useMemo(() => (campaigns ?? []).map((c) => ({ ...c, funnel: campaignFunnel(c.stats) })), [campaigns]);

  const counts = useMemo(
    () => ({ all: rows.length, active: rows.filter((c) => c.status === "active").length, paused: rows.filter((c) => c.status === "paused").length }),
    [rows],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({ leads: t.leads + r.funnel.total, queued: t.queued + r.funnel.queued, messaged: t.messaged + r.funnel.messaged, replied: t.replied + r.funnel.replied, sent: t.sent + r.funnel.messagesSent }),
        { leads: 0, queued: 0, messaged: 0, replied: 0, sent: 0 },
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((c) => filter === "all" || c.status === filter)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term));
  }, [rows, filter, search]);

  const maxReply = Math.max(...filtered.map((c) => c.funnel.replyRate ?? 0), 0.0001);

  const open = (id: string) => {
    if (busyId !== id) router.push(`/whatsapp/campaigns/${id}`);
  };

  async function toggle(c: WhatsappCampaignSummary) {
    const next = c.status === "active" ? "paused" : "active";
    setBusyId(c.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${c.id}`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setCampaigns((prev) => prev?.map((x) => (x.id === c.id ? { ...x, status: next } : x)) ?? prev);
    } catch (cause) {
      await dialogs.alert({ title: `Não foi possível ${next === "paused" ? "pausar" : "iniciar"} a campanha`, description: errorText(cause), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  async function archive(c: WhatsappCampaignSummary) {
    const ok = await dialogs.confirm({
      title: "Arquivar campanha?",
      description: "Os envios param e a campanha sai desta lista. As mensagens já enviadas permanecem em Mensagens e no CRM.",
      confirmLabel: "Arquivar campanha",
      variant: "error",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      await apiJson(`/api/whatsapp/campaigns/${c.id}`, { method: "DELETE" });
      setCampaigns((prev) => prev?.filter((x) => x.id !== c.id) ?? prev);
    } catch (cause) {
      await dialogs.alert({ title: "Não foi possível arquivar a campanha", description: errorText(cause), variant: "error" });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Campanhas de mensagens"
        description="Mensagens e follow-ups de WhatsApp a frio a partir dos seus números. Uma resposta em qualquer canal interrompe a sequência."
        actions={<NewCampaignButton />}
      />

      <KpiStrip className="mt-6" columns={4}>
        <KpiCell icon={RiTeamLine} label="Leads" value={formatCompact(totals.leads)} context={`${formatCompact(totals.queued)} ainda não contatados`} />
        <KpiCell icon={RiSendPlaneLine} label="Contatados" value={formatCompact(totals.messaged)} context={`${formatCompact(totals.sent)} mensagens enviadas`} hint="Leads que receberam pelo menos uma mensagem e estão em sequência, concluídos ou responderam." />
        <KpiCell icon={RiChat1Line} label="Responderam" value={formatCompact(totals.replied)} context={totals.messaged > 0 ? `${formatPercent(totals.replied / totals.messaged)} dos contatados` : undefined} hint="Leads que responderam, em qualquer canal." />
        <KpiCell icon={RiPercentLine} label="Taxa de resposta" value={formatPercent(totals.messaged > 0 ? totals.replied / totals.messaged : null)} context={`${counts.active} ativas, ${counts.paused} pausadas`} hint="Respostas divididas pelos contatados, em todas as campanhas." />
      </KpiStrip>

      <Frame className="mt-5">
        <FrameHeader
          title="Campanhas"
          description="Desde sempre. Selecione uma campanha para ver atividade, leads e sequência."
          actions={
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <SegmentedControl.Root value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SegmentedControl.List className="w-auto">
                  {FILTERS.map((f) => (
                    <SegmentedControl.Trigger key={f} value={f} className="gap-1.5 px-3">
                      {FILTER_LABEL[f]}
                      <span className="tabular-nums text-text-soft-400">{counts[f]}</span>
                    </SegmentedControl.Trigger>
                  ))}
                </SegmentedControl.List>
              </SegmentedControl.Root>
              <Input.Root size="small" className="w-56">
                <Input.Wrapper>
                  <Input.Icon as={RiSearchLine} />
                  <Input.Input type="search" aria-label="Buscar campanhas" placeholder="Buscar campanhas…" value={search} onChange={(e) => setSearch(e.target.value)} />
                </Input.Wrapper>
              </Input.Root>
            </div>
          }
        />
        <FramePanel className="overflow-x-auto p-2 sm:p-2">
          {campaigns === null && !loadError ? (
            <div aria-busy="true" aria-label="Carregando" className="space-y-2 p-2">
              {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
            </div>
          ) : loadError ? (
            <EmptyState
              icon={RiChat1Line}
              title="Não foi possível carregar as campanhas"
              description={loadError}
              action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void load()}>Tentar novamente</Button.Root>}
            />
          ) : filtered.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState
                icon={RiChat1Line}
                title="Nenhuma campanha de mensagens ainda"
                description="Crie uma para enviar a primeira mensagem e os follow-ups a partir dos seus números."
                action={<NewCampaignButton />}
              />
            ) : (
              <EmptyState
                icon={RiSearchLine}
                title="Nenhuma campanha encontrada"
                description="Tente outro status ou busca."
                action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setSearch(""); setFilter("all"); }}>Limpar filtros</Button.Root>}
              />
            )
          ) : (
            <Table.Root className="min-w-[960px] [&>table]:table-fixed">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">Campanha</Table.Head>
                  <Table.Head scope="col" className="w-40 px-4">Números</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right">Leads</Table.Head>
                  <Table.Head scope="col" className="w-24 whitespace-nowrap px-4 text-right" title="Leads que ainda não receberam a primeira mensagem">Não contatados</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4 text-right" title="Leads que receberam uma mensagem">Contatados</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4" title="Leads que responderam e respostas ÷ contatados">Responderam</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Ações</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {filtered.map((c) => {
                  const f = c.funnel;
                  const busy = busyId === c.id;
                  const status = CAMPAIGN_STATUS[c.status];
                  return (
                    <Table.Row
                      key={c.id}
                      tabIndex={0}
                      aria-busy={busy || undefined}
                      onClick={() => open(c.id)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") open(c.id); }}
                      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", busy && "pointer-events-none opacity-60")}
                    >
                      <Table.Cell className="h-16 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="shrink-0" title={f.progress === null ? "Sem leads" : f.queued === 0 ? "Todos os leads foram contatados" : `${Math.round(f.progress * 100)}% dos leads contatados`}>
                            <CampaignProgressRing progress={f.progress} complete={f.total > 0 && f.queued === 0} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-label-sm text-text-strong-950" title={c.name}>{c.name}</span>
                              <Badge.Root size="small" variant="lighter" color={status.color} className="shrink-0">
                                <Badge.Dot />
                                {status.label}
                              </Badge.Root>
                            </div>
                            <p className="mt-0.5 max-w-md truncate text-paragraph-xs text-text-sub-600" title={c.description ?? undefined} suppressHydrationWarning>
                              Criada em {shortDate(c.createdAt)} · {c.stepCount} {c.stepCount === 1 ? "mensagem" : "mensagens"}
                              {c.description ? ` · ${c.description}` : ""}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <span className="block truncate text-paragraph-sm text-text-sub-600" title={c.senders.map((s) => s.name || s.phone).join(", ")}>{senderLabel(c)}</span>
                      </Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{f.total.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", f.queued > 0 ? num : "text-paragraph-sm tabular-nums text-text-soft-400")}>{f.queued.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{f.messaged.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className="px-4">
                        <div className="flex items-center gap-3" title={`${f.replied.toLocaleString("pt-BR")} responderam · ${formatPercent(f.replyRate)}`}>
                          <span className={cn("w-10 text-right", num)}>{f.replied.toLocaleString("pt-BR")}</span>
                          <span className="w-11 text-paragraph-xs tabular-nums text-text-sub-600">{formatPercent(f.replyRate)}</span>
                          <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-bg-weak-50">
                            <span className="block h-full rounded-full" style={{ width: `${((f.replyRate ?? 0) / maxReply) * 100}%`, backgroundColor: WHATSAPP }} />
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowMenu campaign={c} busy={busy} onToggle={() => void toggle(c)} onDelete={() => void archive(c)} onEdit={() => setEditing(c)} />
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table.Root>
          )}
        </FramePanel>
      </Frame>

      <EditWhatsappCampaignModal
        campaign={editing}
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={() => { setEditing(null); void load(); }}
      />
    </div>
  );
}

