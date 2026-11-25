"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RiAddLine,
  RiChat1Line,
  RiCheckDoubleLine,
  RiDeleteBinLine,
  RiLinkedinBoxLine,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPencilLine,
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
import { LinkedInAccountAvatars } from "@/components/linkedin/LinkedInAccountTag";
import { EditCampaignModal } from "@/components/linkedin/campaigns/EditCampaignModal";
import { CAMPAIGN_STATUS, campaignFunnel } from "@/components/linkedin/campaigns/metrics";
import CampaignProgressRing from "@/components/outreach/CampaignProgressRing";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { cn } from "@/utils/cn";

type LinkedInAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };

export type CampaignRow = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED";
  type: "REGULAR" | "PERSONAL";
  accounts: LinkedInAccount[];
  totalLeads: number;
  statusCounts: Record<string, number>;
  createdAt: string;
};

const LINKEDIN = CHANNEL_META.linkedin.color;

const FILTERS = ["ALL", "ACTIVE", "PAUSED"] as const;
type Filter = (typeof FILTERS)[number];
const FILTER_LABEL: Record<Filter, string> = { ALL: "Todas", ACTIVE: "Ativas", PAUSED: "Pausadas" };

const num = "text-paragraph-sm tabular-nums text-text-strong-950";

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", day: "numeric" });
}

/** A count, its rate, and a slim bar scaled to the column's best rate so rows compare. */
function CountRate({ count, rate, max, label }: { count: number; rate: number | null; max: number; label: string }) {
  return (
    <div className="flex items-center gap-3" title={`${count.toLocaleString("pt-BR")} ${label} · ${formatPercent(rate)}`}>
      <span className={cn("w-10 text-right", num)}>{count.toLocaleString("pt-BR")}</span>
      <span className="w-11 text-paragraph-xs tabular-nums text-text-sub-600">{formatPercent(rate)}</span>
      <span aria-hidden="true" className="h-1.5 w-12 rounded-full bg-bg-weak-50">
        <span className="block h-full rounded-full" style={{ width: `${max > 0 ? ((rate ?? 0) / max) * 100 : 0}%`, backgroundColor: LINKEDIN }} />
      </span>
    </div>
  );
}

function RowMenu({
  campaign,
  busy,
  onToggle,
  onDelete,
  onEdit,
}: {
  campaign: CampaignRow;
  busy: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
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
          <Dropdown.ItemIcon as={campaign.status === "ACTIVE" ? RiPauseCircleLine : RiPlayCircleLine} />
          {campaign.status === "ACTIVE" ? "Pausar campanha" : "Retomar campanha"}
        </Dropdown.Item>
        <Dropdown.Separator />
        <Dropdown.Item destructive onSelect={onDelete}>
          <Dropdown.ItemIcon as={RiDeleteBinLine} />
          Excluir campanha
        </Dropdown.Item>
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

export function CampaignsClient({
  campaigns: initial,
  accounts,
}: {
  campaigns: CampaignRow[];
  accounts: LinkedInAccount[];
}) {
  const dialogs = useDialogs();
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initial);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const rows = useMemo(() => campaigns.map((c) => ({ ...c, funnel: campaignFunnel(c.statusCounts, c.totalLeads) })), [campaigns]);

  const counts = useMemo(
    () => ({
      ALL: campaigns.length,
      ACTIVE: campaigns.filter((c) => c.status === "ACTIVE").length,
      PAUSED: campaigns.filter((c) => c.status === "PAUSED").length,
    }),
    [campaigns],
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (t, r) => ({
          leads: t.leads + r.funnel.total,
          queued: t.queued + r.funnel.queued,
          invited: t.invited + r.funnel.invited,
          accepted: t.accepted + r.funnel.accepted,
          replied: t.replied + r.funnel.replied,
        }),
        { leads: 0, queued: 0, invited: 0, accepted: 0, replied: 0 },
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows
      .filter((c) => filter === "ALL" || c.status === filter)
      .filter((c) => !term || c.name.toLowerCase().includes(term) || (c.description ?? "").toLowerCase().includes(term));
  }, [rows, filter, search]);

  const maxAccept = Math.max(...filtered.map((c) => c.funnel.acceptanceRate ?? 0), 0.0001);
  const maxReply = Math.max(...filtered.map((c) => c.funnel.replyRate ?? 0), 0.0001);

  const open = (id: string) => {
    if (deletingId !== id) router.push(`/linkedin/campaigns/${id}`);
  };

  const handleToggleStatus = async (c: CampaignRow) => {
    setTogglingId(c.id);
    const newStatus = c.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/linkedin/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.ok) setCampaigns((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: newStatus } : x)));
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (deletingId) return;
    const ok = await dialogs.confirm({
      title: "Excluir campanha?",
      description: "Todos os leads e o histórico de convites e mensagens vinculados serão excluídos permanentemente. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir campanha",
      variant: "error",
    });
    if (!ok) return;
    setDeletingId(id);
    try {
      const response = await fetch(`/api/linkedin/campaigns/${id}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) throw new Error(data.error ?? "Não foi possível excluir a campanha");
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } catch (cause) {
      await dialogs.alert({
        title: "Não foi possível excluir a campanha",
        description: cause instanceof Error ? cause.message : "Algo deu errado. Tente novamente.",
        variant: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Campanhas do LinkedIn"
        description="Convites e acompanhamentos das suas contas do LinkedIn, e o desempenho de cada campanha."
        actions={
          <Button.Root variant="primary" mode="filled" size="small" asChild>
            <Link href="/linkedin/campaigns/new">
              <Button.Icon as={RiAddLine} />
              Criar nova campanha
            </Link>
          </Button.Root>
        }
      />

      <KpiStrip className="mt-6" columns={5}>
        <KpiCell icon={RiLinkedinBoxLine} label="Campanhas ativas" value={formatCompact(counts.ACTIVE)} context={`${counts.PAUSED} pausadas`} />
        <KpiCell icon={RiTeamLine} label="Leads" value={formatCompact(totals.leads)} context={`${formatCompact(totals.queued)} ainda não convidados`} />
        <KpiCell icon={RiSendPlaneLine} label="Convidados" value={formatCompact(totals.invited)} context={totals.leads > 0 ? `${formatPercent(totals.invited / totals.leads)} dos leads` : undefined} hint="Leads que receberam um convite, independentemente do resultado. Desde sempre." />
        <KpiCell
          icon={RiCheckDoubleLine}
          label="Taxa de aceite"
          value={formatPercent(totals.invited > 0 ? totals.accepted / totals.invited : null)}
          context={`${formatCompact(totals.accepted)} de ${formatCompact(totals.invited)} aceitos`}
          hint="Aceitos divididos por convidados em todas as campanhas."
        />
        <KpiCell
          icon={RiChat1Line}
          label="Respostas"
          value={formatCompact(totals.replied)}
          context={totals.accepted > 0 ? `${formatPercent(totals.replied / totals.accepted)} dos aceitos` : undefined}
          hint="Leads que responderam. A taxa de resposta é respostas divididas por aceitos, como em Analytics."
        />
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
          {filtered.length === 0 ? (
            campaigns.length === 0 ? (
              <EmptyState
                icon={RiLinkedinBoxLine}
                title="Nenhuma campanha do LinkedIn ainda"
                description="Crie uma para enviar convites e acompanhamentos pelas suas contas do LinkedIn."
                action={
                  <Button.Root variant="primary" mode="filled" size="small" asChild>
                    <Link href="/linkedin/campaigns/new">
                      <Button.Icon as={RiAddLine} />
                      Criar nova campanha
                    </Link>
                  </Button.Root>
                }
              />
            ) : (
              <EmptyState
                icon={RiSearchLine}
                title="Nenhuma campanha encontrada"
                description="Tente outro status ou termo de busca."
                action={
                  <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => { setSearch(""); setFilter("ALL"); }}>
                    Limpar filtros
                  </Button.Root>
                }
              />
            )
          ) : (
            <Table.Root className="min-w-[1080px] [&>table]:table-fixed">
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="px-4">Campanha</Table.Head>
                  <Table.Head scope="col" className="w-24 px-4">Remetentes</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right">Leads</Table.Head>
                  <Table.Head scope="col" className="w-24 whitespace-nowrap px-4 text-right" title="Leads que ainda não receberam convite">Não convidados</Table.Head>
                  <Table.Head scope="col" className="w-20 px-4 text-right" title="Leads que receberam convite">Convidados</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4" title="Conexões aceitas e aceitos ÷ convidados">Aceitos</Table.Head>
                  <Table.Head scope="col" className="w-48 px-4" title="Leads que responderam e respostas ÷ aceitos">Respostas</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Ações</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {filtered.map((c) => {
                  const f = c.funnel;
                  const deleting = deletingId === c.id;
                  const status = CAMPAIGN_STATUS[c.status];
                  return (
                    <Table.Row
                      key={c.id}
                      tabIndex={0}
                      aria-busy={deleting || undefined}
                      onClick={() => open(c.id)}
                      onKeyDown={(e) => { if (e.target === e.currentTarget && e.key === "Enter") open(c.id); }}
                      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", deleting && "pointer-events-none opacity-60")}
                    >
                      <Table.Cell className="h-16 px-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="shrink-0" title={f.progress === null ? "Sem leads" : f.queued === 0 ? "Todos os leads foram convidados" : `${Math.round(f.progress * 100)}% dos leads convidados`}>
                            <CampaignProgressRing progress={f.progress} complete={f.total > 0 && f.queued === 0} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-label-sm text-text-strong-950" title={c.name}>{c.name}</span>
                              <Badge.Root size="small" variant="lighter" color={status.color} className="shrink-0">
                                <Badge.Dot />
                                {status.label}
                              </Badge.Root>
                              {deleting && <span className="shrink-0 text-paragraph-xs text-error-base">Excluindo…</span>}
                            </div>
                            <p className="mt-0.5 max-w-md truncate text-paragraph-xs text-text-sub-600" title={c.description ?? undefined} suppressHydrationWarning>
                              {c.type === "PERSONAL" ? "Pessoal · " : ""}Criada em {shortDate(c.createdAt)}
                              {c.description ? ` · ${c.description}` : ""}
                            </p>
                          </div>
                        </div>
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <LinkedInAccountAvatars accounts={c.accounts} maxVisible={2} />
                      </Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{f.total.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", f.queued > 0 ? num : "text-paragraph-sm tabular-nums text-text-soft-400")}>{f.queued.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className={cn("px-4 text-right", num)}>{f.invited.toLocaleString("pt-BR")}</Table.Cell>
                      <Table.Cell className="px-4">
                        <CountRate count={f.accepted} rate={f.acceptanceRate} max={maxAccept} label="aceitos" />
                      </Table.Cell>
                      <Table.Cell className="px-4">
                        <CountRate count={f.replied} rate={f.replyRate} max={maxReply} label="respostas" />
                      </Table.Cell>
                      <Table.Cell className="px-4" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <div className="flex justify-end">
                          <RowMenu
                            campaign={c}
                            busy={togglingId === c.id || deleting}
                            onToggle={() => void handleToggleStatus(c)}
                            onDelete={() => void handleDelete(c.id)}
                            onEdit={() => setEditing(c)}
                          />
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

      <EditCampaignModal
        campaign={editing}
        accounts={accounts}
        open={editing !== null}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
        onSaved={(updated) => {
          const id = editing?.id;
          setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)));
          setEditing(null);
        }}
      />
    </div>
  );
}
