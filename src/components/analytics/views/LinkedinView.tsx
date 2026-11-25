"use client";

import Link from "next/link";
import { RiChat1Line, RiCheckDoubleLine, RiMailSendLine, RiPercentLine, RiSendPlaneLine, RiUserAddLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Table from "@/components/alignui/table";
import type { LinkedinAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { FunnelChart, type FunnelStage } from "../kit/FunnelChart";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RateCell } from "../kit/RateCell";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { TickMeter } from "../kit/TickMeter";
import { TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { ACCENT, APOLLO, CHANNEL_META, formatCompact, formatPercent, MUTED, STATUS } from "../theme";
import type { ViewProps } from "./types";

const LINKEDIN = CHANNEL_META.linkedin.color;

const ACTIVITY_KEYS: SeriesKeys<"invites" | "accepted" | "replied"> = {
  invites: { label: "Convites", color: LINKEDIN },
  accepted: { label: "Aceitos", color: APOLLO.lavender },
  replied: { label: "Responderam", color: CHANNEL_META.whatsapp.color },
};

const HINTS = {
  invites: "Convites de conexão enviados no período.",
  accepted: "Conexões aceitas no período. Contadas quando a aceitação é registrada, mesmo que o convite tenha sido enviado antes.",
  acceptanceRate: "Aceitos divididos pelos convites enviados no mesmo período.",
  messages: "Mensagens enviadas após a conexão: mensagem de aceitação, follow-ups 1 a 3 e mensagens personalizadas.",
  replied: "Leads distintos que responderam no período.",
  replyRate: "Respondidos divididos pelas conexões aceitas, não pelos convites enviados.",
};

const CAMPAIGN_STATUS = {
  ACTIVE: { tone: "good", label: "Ativa" },
  PAUSED: { tone: "warning", label: "Pausada" },
} as const;

export function LinkedinView({ data, loading }: ViewProps<"linkedin">) {
  const { kpis, range } = data;
  const unit = range.bucket === "week" ? "semana" : "dia";
  const vsPrevious = (metric: { previous: number | null }) => (metric.previous === null ? undefined : `vs ${formatCompact(metric.previous)} no período anterior`);
  const vsPreviousRate = (metric: { previous: number | null }) => (metric.previous === null ? undefined : `vs ${formatPercent(metric.previous)} no período anterior`);
  const spark = (key: "invites" | "accepted" | "replied") => data.activity.points.map((point) => point[key]);
  const stages: FunnelStage[] = data.funnel.filter((stage) => stage.key !== "messaged");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiSendPlaneLine} label="Convites enviados" value={formatCompact(kpis.invites.value)} metric={kpis.invites} hint={HINTS.invites} context={vsPrevious(kpis.invites)} spark={spark("invites")} />
        <KpiCell icon={RiUserAddLine} label="Aceitos" value={formatCompact(kpis.accepted.value)} metric={kpis.accepted} hint={HINTS.accepted} context={vsPrevious(kpis.accepted)} spark={spark("accepted")} />
        <KpiCell icon={RiCheckDoubleLine} label="Taxa de aceite" value={formatPercent(kpis.acceptanceRate.value)} metric={kpis.acceptanceRate} hint={HINTS.acceptanceRate} context={vsPreviousRate(kpis.acceptanceRate)} />
        <KpiCell icon={RiMailSendLine} label="Mensagens enviadas" value={formatCompact(kpis.messages.value)} metric={kpis.messages} hint={HINTS.messages} context={vsPrevious(kpis.messages)} />
        <KpiCell icon={RiChat1Line} label="Responderam" value={formatCompact(kpis.replied.value)} metric={kpis.replied} hint={HINTS.replied} context={`de ${formatCompact(kpis.accepted.value)} aceitos`} spark={spark("replied")} />
        <KpiCell icon={RiPercentLine} label="Taxa de resposta" value={formatPercent(kpis.replyRate.value)} metric={kpis.replyRate} hint={HINTS.replyRate} context={kpis.replyRate.previous === null ? "respondidos / aceitos" : `respondidos / aceitos, vs ${formatPercent(kpis.replyRate.previous)} antes`} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title="Convites, aceites e respostas"
        description={`Atividade no LinkedIn a cada ${unit}.`}
        legend={
          <SeriesStats
            items={(Object.keys(ACTIVITY_KEYS) as Array<keyof typeof ACTIVITY_KEYS>).map((key) => ({
              label: ACTIVITY_KEYS[key].label,
              color: ACTIVITY_KEYS[key].color,
              value: formatCompact(kpis[key].value),
            }))}
          />
        }
        loading={loading}
        table={<TimeSeriesTable series={data.activity} keys={ACTIVITY_KEYS} bucket={range.bucket} caption="Convites, aceites e respostas no LinkedIn" />}
      >
        <TimeSeriesChart series={data.activity} keys={ACTIVITY_KEYS} type="line" bucket={range.bucket} />
      </ChartCard>

      <ChartCard className="self-start lg:col-span-4" title="Funil do LinkedIn" description="Convidados → aceitos → responderam." loading={loading} footer="Contagens do período, não o acompanhamento de uma única coorte.">
        <FunnelChart stages={stages} />
      </ChartCard>

      <AccountsTable accounts={data.accounts} loading={loading} />
      <InviteCapacity accounts={data.accounts} loading={loading} />

      <CampaignsTable campaigns={data.campaigns} loading={loading} />
    </div>
  );
}

function AccountsTable({ accounts, loading }: { accounts: LinkedinAnalytics["accounts"]; loading: boolean }) {
  const rows = [...accounts].sort((first, second) => Number(first.status === "CONNECTED") - Number(second.status === "CONNECTED") || first.name.localeCompare(second.name));
  return (
    <Frame className="self-start lg:col-span-8">
      <FrameHeader title="Contas" description="Agora, independentemente do período. Contas desconectadas primeiro." />
      <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {rows.length === 0 ? (
          <p className="py-10 text-center text-paragraph-sm text-text-sub-600">Nenhuma conta do LinkedIn conectada ainda.</p>
        ) : (
          <Table.Root>
            <Table.Caption className="sr-only">Contas do LinkedIn</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">Conta</Table.Head>
                <Table.Head scope="col">Status</Table.Head>
                <Table.Head scope="col" className="min-w-44">Convites hoje</Table.Head>
                <Table.Head scope="col" className="text-right">Fila pendente</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {rows.map((account) => {
                const connected = account.status === "CONNECTED";
                return (
                  <Table.Row key={account.id}>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-2">
                        <span className="max-w-48 truncate text-label-sm text-text-strong-950">{account.name}</span>
                        {account.premium && <Badge.Root variant="lighter" color="purple" size="small">Premium</Badge.Root>}
                      </div>
                    </Table.Cell>
                    <Table.Cell className="h-12"><StatusDotBadge status={connected ? "good" : "critical"}>{connected ? "Conectada" : "Desconectada"}</StatusDotBadge></Table.Cell>
                    <Table.Cell className="h-12">
                      {connected ? <InlineMeter used={account.sentToday} limit={account.dailyLimit} /> : <span className="text-paragraph-sm text-text-soft-400">Pausada até reconectar</span>}
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(account.pending)}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/linkedin-accounts">Gerenciar contas do LinkedIn</FrameFooterLink>
    </Frame>
  );
}

function InlineMeter({ used, limit }: { used: number; limit: number }) {
  const full = limit > 0 && used >= limit;
  const filled = limit > 0 ? Math.min(10, Math.round((used / limit) * 10)) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 text-paragraph-sm tabular-nums text-text-strong-950">
        {used} <span className="text-text-soft-400">/ {limit}</span>
      </span>
      <span role="meter" aria-label="Convites hoje" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} className="flex h-1.5 w-24 gap-0.5">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className="h-full flex-1 rounded-[2px]" style={{ backgroundColor: index < filled ? (full ? STATUS.critical : ACCENT) : "var(--color-bg-soft-200)" }} />
        ))}
      </span>
      {full && <span className="text-paragraph-xs text-text-sub-600">No limite</span>}
    </div>
  );
}

function InviteCapacity({ accounts, loading }: { accounts: LinkedinAnalytics["accounts"]; loading: boolean }) {
  const connected = accounts.filter((account) => account.status === "CONNECTED");
  const used = connected.reduce((sum, account) => sum + account.sentToday, 0);
  const limit = connected.reduce((sum, account) => sum + account.dailyLimit, 0);
  const atCap = connected.filter((account) => account.dailyLimit > 0 && account.sentToday >= account.dailyLimit).length;
  return (
    <Frame className="self-start lg:col-span-4">
      <FrameHeader title="Capacidade diária de convites" description="Contas conectadas, hoje." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {connected.length === 0 ? (
          <p className="py-6 text-center text-paragraph-sm text-text-sub-600">Nenhuma conta conectada para enviar.</p>
        ) : (
          <>
            <TickMeter label="Convites enviados hoje" used={used} limit={limit} caption={`${used.toLocaleString("pt-BR")} de ${limit.toLocaleString("pt-BR")} convites enviados hoje`} />
            <p className="mt-4 text-paragraph-sm text-text-sub-600">
              {atCap} {atCap === 1 ? "conta está" : "contas estão"} no limite diário
            </p>
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: LinkedinAnalytics["campaigns"]; loading: boolean }) {
  const maxAccept = Math.max(...campaigns.map((campaign) => campaign.acceptanceRate ?? 0), 0.0001);
  const maxReply = Math.max(...campaigns.map((campaign) => campaign.replyRate ?? 0), 0.0001);
  const num = "h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950";
  return (
    <Frame className="lg:col-span-12">
      <FrameHeader title="Campanhas" description="Convites são do período; as demais contagens são por campanha. Taxa de resposta é respondidos / aceitos." />
      <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {campaigns.length === 0 ? (
          <p className="py-10 text-center text-paragraph-sm text-text-sub-600">Nenhuma campanha do LinkedIn ainda.</p>
        ) : (
          <Table.Root>
            <Table.Caption className="sr-only">Campanhas do LinkedIn</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">Campanha</Table.Head>
                <Table.Head scope="col" className="text-right">Leads</Table.Head>
                <Table.Head scope="col">Convidados</Table.Head>
                <Table.Head scope="col" className="text-right">Aceitos</Table.Head>
                <Table.Head scope="col">Taxa de aceite</Table.Head>
                <Table.Head scope="col" className="text-right">Responderam</Table.Head>
                <Table.Head scope="col">Taxa de resposta</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {campaigns.map((campaign) => {
                const status = campaign.status === "ACTIVE" ? CAMPAIGN_STATUS.ACTIVE : campaign.status === "PAUSED" ? CAMPAIGN_STATUS.PAUSED : { tone: "neutral" as const, label: campaign.status };
                return (
                  <Table.Row key={campaign.id}>
                    <Table.Cell className="h-12">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link href={`/linkedin/campaigns/${campaign.id}`} className="max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{campaign.name}</Link>
                        <StatusDotBadge status={status.tone}>{status.label}</StatusDotBadge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.leads)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.invited)}</span>
                        <Sparkline data={campaign.trend} color={MUTED} className="hidden w-16 sm:block" />
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.accepted)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={campaign.acceptanceRate} max={maxAccept} color={LINKEDIN} /></Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.replied)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={campaign.replyRate} max={maxReply} color={LINKEDIN} /></Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </FramePanel>
    </Frame>
  );
}
