"use client";

import Link from "next/link";
import { RiAlertLine, RiChat1Line, RiInformationLine, RiMailForbidLine, RiMailSendLine, RiPercentLine, RiUserSharedLine, RiUserUnfollowLine } from "@remixicon/react";
import * as Table from "@/components/alignui/table";
import type { EmailAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { CapacityMeter } from "../kit/CapacityMeter";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RateCell } from "../kit/RateCell";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { TickMeter } from "../kit/TickMeter";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { CHANNEL_META, formatCompact, formatPercent, MUTED } from "../theme";
import type { ViewProps } from "./types";

const EMAIL = CHANNEL_META.email.color;

const SEND_KEYS: SeriesKeys<"firstTouch" | "followUp"> = {
  firstTouch: { label: "Primeiro contato", color: EMAIL },
  followUp: { label: "Follow-ups", color: MUTED },
};
const REPLY_KEYS: SeriesKeys<"replies"> = { replies: { label: "Respostas", color: EMAIL } };

const HINTS = {
  sent: "E-mails enviados no período, incluindo primeiros contatos e follow-ups.",
  contacted: "Leads distintos que receberam o primeiro e-mail no período.",
  replied: "Pessoas distintas em campanhas de e-mail que responderam no período.",
  replyRate: "Respostas divididas pelos leads contatados no mesmo período.",
  bounced: "Endereços adicionados à lista de supressão por rejeição no período.",
  unsubscribed: "Endereços adicionados à lista de supressão por cancelamento no período.",
};

const CAMPAIGN_STATUS: Record<string, { tone: "good" | "warning" | "neutral" | "info"; label: string }> = {
  active: { tone: "good", label: "Ativa" },
  paused: { tone: "warning", label: "Pausada" },
  draft: { tone: "neutral", label: "Rascunho" },
  completed: { tone: "info", label: "Concluída" },
};

function totalsSpark(series: EmailAnalytics["sends"]): number[] {
  return series.points.map((point) => point.firstTouch + point.followUp);
}

export function EmailView({ data, loading }: ViewProps<"email">) {
  const { kpis, range } = data;
  const unit = range.bucket === "week" ? "semana" : "dia";
  const vsPrevious = (metric: { previous: number | null }) => (metric.previous === null ? undefined : `vs ${formatCompact(metric.previous)} no período anterior`);
  const repliesTotal = seriesTotal(data.replies, "replies");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiMailSendLine} label="E-mails enviados" value={formatCompact(kpis.sent.value)} metric={kpis.sent} hint={HINTS.sent} context={vsPrevious(kpis.sent)} spark={totalsSpark(data.sends)} />
        <KpiCell icon={RiUserSharedLine} label="Leads contatados" value={formatCompact(kpis.contacted.value)} metric={kpis.contacted} hint={HINTS.contacted} context={vsPrevious(kpis.contacted)} />
        <KpiCell icon={RiChat1Line} label="Responderam" value={formatCompact(kpis.replied.value)} metric={kpis.replied} hint={HINTS.replied} context={`de ${formatCompact(kpis.contacted.value)} contatados`} spark={data.replies.points.map((point) => point.replies)} />
        <KpiCell icon={RiPercentLine} label="Taxa de resposta" value={formatPercent(kpis.replyRate.value)} metric={kpis.replyRate} hint={HINTS.replyRate} context={kpis.replyRate.previous === null ? undefined : `vs ${formatPercent(kpis.replyRate.previous)} no período anterior`} />
        <KpiCell icon={RiMailForbidLine} label="Rejeitados" value={formatCompact(kpis.bounced.value)} metric={kpis.bounced} upIsGood={false} hint={HINTS.bounced} context={vsPrevious(kpis.bounced)} />
        <KpiCell icon={RiUserUnfollowLine} label="Cancelamentos" value={formatCompact(kpis.unsubscribed.value)} metric={kpis.unsubscribed} upIsGood={false} hint={HINTS.unsubscribed} context={vsPrevious(kpis.unsubscribed)} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title="Volume de envios"
        description={`E-mails enviados a cada ${unit}: primeiros contatos e follow-ups.`}
        legend={
          <SeriesStats
            items={[
              { label: SEND_KEYS.firstTouch.label, color: SEND_KEYS.firstTouch.color, value: formatCompact(seriesTotal(data.sends, "firstTouch")) },
              { label: SEND_KEYS.followUp.label, color: SEND_KEYS.followUp.color, value: formatCompact(seriesTotal(data.sends, "followUp")) },
            ]}
          />
        }
        loading={loading}
        table={<TimeSeriesTable series={data.sends} keys={SEND_KEYS} bucket={range.bucket} caption="E-mails enviados por tipo" />}
        footer={
          data.failedSends > 0 ? (
            <span className="flex items-center gap-1.5">
              <RiAlertLine className="size-4 shrink-0 text-warning-base" aria-hidden="true" />
              {data.failedSends.toLocaleString("pt-BR")} {data.failedSends === 1 ? "envio falhou" : "envios falharam"} no período
            </span>
          ) : undefined
        }
      >
        <TimeSeriesChart series={data.sends} keys={SEND_KEYS} type="stackedBar" bucket={range.bucket} height={440} />
      </ChartCard>

      <MailboxCapacity mailboxes={data.mailboxes} loading={loading} />

      <ChartCard
        className="lg:col-span-8"
        title="Respostas"
        description={`Respostas de e-mail recebidas a cada ${unit}.`}
        legend={<SeriesStats items={[{ label: "Respostas", color: EMAIL, value: formatCompact(repliesTotal), metric: kpis.replied }]} />}
        loading={loading}
        table={<TimeSeriesTable series={data.replies} keys={REPLY_KEYS} bucket={range.bucket} caption="Respostas de e-mail" />}
      >
        <TimeSeriesChart series={data.replies} keys={REPLY_KEYS} type="bar" bucket={range.bucket} />
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title="Não monitorado" />
        <FramePanel className="bg-information-lighter ring-information-light/40 sm:p-5">
          <div className="flex items-start gap-3">
            <RiInformationLine className="mt-0.5 size-5 shrink-0 text-information-base" aria-hidden="true" />
            <p className="text-paragraph-sm text-text-sub-600">
              Aberturas e cliques não são registrados, por isso não há taxas de abertura ou clique. A taxa de resposta é a métrica de engajamento acompanhada.
            </p>
          </div>
        </FramePanel>
      </Frame>

      <CampaignsTable campaigns={data.campaigns} loading={loading} />
    </div>
  );
}

function MailboxCapacity({ mailboxes, loading }: { mailboxes: EmailAnalytics["mailboxes"]; loading: boolean }) {
  const top = [...mailboxes.rows].sort((first, second) => second.sentToday - first.sentToday).slice(0, 5);
  return (
    <Frame className="lg:col-span-4">
      <FrameHeader title="Capacidade das caixas hoje" description="Agora, independentemente do período selecionado." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {mailboxes.total === 0 ? (
          <p className="py-6 text-center text-paragraph-sm text-text-sub-600">Nenhuma caixa conectada ainda.</p>
        ) : (
          <>
            <TickMeter label="Enviados hoje" used={mailboxes.sentToday} limit={mailboxes.capacityToday} caption={`${mailboxes.sentToday.toLocaleString("pt-BR")} de ${mailboxes.capacityToday.toLocaleString("pt-BR")} enviados hoje`} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <StatusDotBadge status="good">{mailboxes.connected} conectadas</StatusDotBadge>
              <StatusDotBadge status={mailboxes.failing > 0 ? "critical" : "neutral"}>{mailboxes.failing} com falha</StatusDotBadge>
            </div>
            {top.length > 0 && (
              <ul className="mt-5 flex flex-col gap-4 border-t border-stroke-soft-200 pt-4">
                {top.map((mailbox) => (
                  <li key={mailbox.id}>
                    <CapacityMeter label={mailbox.email} used={mailbox.sentToday} limit={mailbox.dailyLimit} segments={16} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/email-accounts">Gerenciar caixas</FrameFooterLink>
    </Frame>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: EmailAnalytics["campaigns"]; loading: boolean }) {
  const maxRate = Math.max(...campaigns.map((campaign) => campaign.replyRate ?? 0), 0.0001);
  const num = "h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950";
  return (
    <Frame className="lg:col-span-12">
      <FrameHeader title="Campanhas" description="Envios são do período; leads, respostas e rejeições são acumulados. Ordenado por envios." />
      <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {campaigns.length === 0 ? (
          <p className="py-10 text-center text-paragraph-sm text-text-sub-600">Nenhuma campanha de e-mail ainda.</p>
        ) : (
          <Table.Root>
            <Table.Caption className="sr-only">Campanhas de e-mail</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">Campanha</Table.Head>
                <Table.Head scope="col" className="text-right">Leads</Table.Head>
                <Table.Head scope="col" className="text-right">Contatados</Table.Head>
                <Table.Head scope="col">Enviados</Table.Head>
                <Table.Head scope="col" className="text-right">Responderam</Table.Head>
                <Table.Head scope="col">Taxa de resposta</Table.Head>
                <Table.Head scope="col" className="text-right">Rejeitados</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {campaigns.map((campaign) => {
                const status = CAMPAIGN_STATUS[campaign.status] ?? { tone: "neutral" as const, label: campaign.status };
                return (
                  <Table.Row key={campaign.id}>
                    <Table.Cell className="h-12">
                      <div className="flex min-w-0 items-center gap-3">
                        <Link href={`/outreach/campaigns/${campaign.id}`} className="max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{campaign.name}</Link>
                        <StatusDotBadge status={status.tone}>{status.label}</StatusDotBadge>
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.leads)}</Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.contacted)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-10 text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.sentInRange)}</span>
                        <Sparkline data={campaign.trend} color={MUTED} className="hidden w-16 sm:block" />
                      </div>
                    </Table.Cell>
                    <Table.Cell className={num}>{formatCompact(campaign.replied)}</Table.Cell>
                    <Table.Cell className="h-12"><RateCell rate={campaign.replyRate} max={maxRate} color={EMAIL} /></Table.Cell>
                    <Table.Cell className={cn(num, campaign.bounced === 0 && "text-text-soft-400")}>{formatCompact(campaign.bounced)}</Table.Cell>
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
