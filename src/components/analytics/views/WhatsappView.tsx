"use client";

import Link from "next/link";
import { RiArrowRightSLine, RiChat3Line, RiChatNewLine, RiCheckLine, RiErrorWarningLine, RiLoader4Line, RiMessage2Line, RiPercentLine, RiQuestionLine, RiTimeLine, RiUserReceived2Line, RiVoiceprintLine, RiWhatsappLine, RiPhoneFill, RiPhoneLine } from "@remixicon/react";
import * as Table from "@/components/alignui/table";
import type { WhatsappAnalytics, WhatsappCallOutcome } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { CapacityMeter } from "../kit/CapacityMeter";
import { ChartCard } from "../kit/ChartCard";
import { DonutChart } from "../kit/DonutChart";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { SectionHeading } from "../kit/SectionHeading";
import { SeriesStats } from "../kit/SeriesStats";
import { Sparkline } from "../kit/Sparkline";
import { StatusDotBadge } from "../kit/StatusDotBadge";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { APOLLO, CHANNEL_META, formatCompact, formatDuration, formatPercent, MUTED, STATUS } from "../theme";
import type { ViewProps } from "./types";

const WA = CHANNEL_META.whatsapp.color;
const RECEIVED = APOLLO.lavender;

const CALL_KEYS: SeriesKeys<"connected" | "notConnected"> = {
  connected: { label: "Conectadas", color: WA },
  notConnected: { label: "Não conectadas", color: MUTED },
};
const MESSAGE_KEYS: SeriesKeys<"sent" | "received"> = {
  sent: { label: "Enviadas", color: WA },
  received: { label: "Recebidas", color: RECEIVED },
};

type Icon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const OUTCOMES: Record<WhatsappCallOutcome, { label: string; color: string; icon: Icon }> = {
  connected: { label: "Conectada", color: WA, icon: RiCheckLine },
  didNotPickUp: { label: "Não atendeu", color: MUTED, icon: RiPhoneLine },
  notOnWhatsApp: { label: "Não tem WhatsApp", color: STATUS.warning, icon: RiQuestionLine },
  failed: { label: "Falhou", color: STATUS.critical, icon: RiErrorWarningLine },
  inProgress: { label: "Em andamento", color: "var(--chart-muted-strong)", icon: RiLoader4Line },
};

const HINTS = {
  calls: "Ligações do WhatsApp feitas a partir do Apollo Intelligence no período, independentemente do desfecho.",
  connected: "Ligações em que o lead atendeu.",
  connectRate: "Ligações conectadas divididas pelas ligações feitas.",
  talk: "Tempo total em ligações conectadas.",
  avg: "Tempo de conversa dividido pelas ligações conectadas.",
  sent: "Mensagens enviadas pelo Apollo Intelligence, pelo telefone ou pelo WhatsApp Web.",
  received: "Mensagens recebidas dos leads.",
  replyRate: "Dos chats em que você enviou uma mensagem no período, a parcela que recebeu uma resposta depois.",
  newChats: "Chats iniciados pelo Apollo Intelligence no período (a primeira mensagem saiu do Apollo Intelligence).",
};

const CAMPAIGN_STATUS: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  draft: "Rascunho",
  completed: "Concluída",
  connected: "Conectado",
  disconnected: "Desconectado",
};

const vsPrevious = (metric: { previous: number | null }, format: (value: number) => string = formatCompact) => (metric.previous === null ? undefined : `vs ${format(metric.previous)} no período anterior`);

export function WhatsappView({ data, loading }: ViewProps<"whatsapp">) {
  const { kpis, range } = data;
  const unit = range.bucket === "week" ? "semana" : "dia";
  const placedSpark = data.calls.points.map((point) => point.connected + point.notConnected);
  const connectedSpark = data.calls.points.map((point) => point.connected);
  const totalCalls = kpis.calls.value;
  const nullable = (metric: { value: number | null; previous: number | null }) => ({ value: metric.value, previous: metric.previous });

  const callStats = [
    { label: "Conectadas", color: WA, value: formatCompact(seriesTotal(data.calls, "connected")), metric: kpis.connected },
    { label: "Não conectadas", color: MUTED, value: formatCompact(seriesTotal(data.calls, "notConnected")) },
  ];
  const messageStats = [
    { label: "Enviadas", color: WA, value: formatCompact(kpis.messagesSent.value), metric: kpis.messagesSent },
    { label: "Recebidas", color: RECEIVED, value: formatCompact(kpis.messagesReceived.value), metric: kpis.messagesReceived },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <SectionHeading title="Ligações" description="Ligações de voz feitas a partir do Apollo Intelligence e registradas no WhatsApp Web." />
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiPhoneLine} label="Ligações feitas" value={formatCompact(kpis.calls.value)} metric={kpis.calls} hint={HINTS.calls} context={vsPrevious(kpis.calls)} spark={placedSpark} />
        <KpiCell icon={RiPhoneFill} label="Conectadas" value={formatCompact(kpis.connected.value)} metric={kpis.connected} hint={HINTS.connected} context={vsPrevious(kpis.connected)} spark={connectedSpark} />
        <KpiCell icon={RiPercentLine} label="Taxa de conexão" value={formatPercent(kpis.connectRate.value)} metric={nullable(kpis.connectRate)} hint={HINTS.connectRate} context={`de ${formatCompact(totalCalls)} ligações`} />
        <KpiCell icon={RiTimeLine} label="Tempo de conversa" value={formatDuration(kpis.talkTimeMs.value)} metric={kpis.talkTimeMs} hint={HINTS.talk} context={vsPrevious(kpis.talkTimeMs, formatDuration)} />
        <KpiCell icon={RiVoiceprintLine} label="Duração média" value={formatDuration(kpis.avgCallMs.value)} metric={nullable(kpis.avgCallMs)} hint={HINTS.avg} context="por ligação conectada" />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title="Ligações"
        description={`Ligações feitas a cada ${unit}, conectadas ou não.`}
        legend={<SeriesStats items={callStats} />}
        loading={loading}
        footer="As ligações ainda não são atribuídas a um vendedor ou número."
        table={<TimeSeriesTable series={data.calls} keys={CALL_KEYS} bucket={range.bucket} caption="Ligações por desfecho" />}
      >
        <TimeSeriesChart series={data.calls} keys={CALL_KEYS} type="stackedBar" bucket={range.bucket} />
      </ChartCard>

      <Frame className="lg:col-span-4 lg:self-start" aria-busy={loading || undefined}>
        <FrameHeader title="Desfechos das ligações" description="Como cada ligação terminou no período." />
        <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
          <DonutChart items={data.outcomes.map((outcome) => ({ key: outcome.key, label: OUTCOMES[outcome.key].label, value: outcome.value, color: OUTCOMES[outcome.key].color, icon: OUTCOMES[outcome.key].icon }))} centerLabel="ligações" emptyLabel="Nenhuma ligação no período" />
        </FramePanel>
      </Frame>

      <CampaignsTable campaigns={data.campaigns} loading={loading} />

      <SectionHeading title="Mensagens" description="Conversas de texto nos números conectados, por direção." />
      <KpiStrip className="lg:col-span-12" columns={4}>
        <KpiCell icon={RiMessage2Line} label="Mensagens enviadas" value={formatCompact(kpis.messagesSent.value)} metric={kpis.messagesSent} hint={HINTS.sent} context={vsPrevious(kpis.messagesSent)} spark={data.messages.points.map((point) => point.sent)} />
        <KpiCell icon={RiUserReceived2Line} label="Mensagens recebidas" value={formatCompact(kpis.messagesReceived.value)} metric={kpis.messagesReceived} hint={HINTS.received} context={vsPrevious(kpis.messagesReceived)} spark={data.messages.points.map((point) => point.received)} />
        <KpiCell icon={RiChat3Line} label="Taxa de resposta" value={formatPercent(kpis.chatReplyRate.value)} metric={nullable(kpis.chatReplyRate)} hint={HINTS.replyRate} context="dos chats em que você escreveu" />
        <KpiCell icon={RiChatNewLine} label="Novos chats" value={formatCompact(kpis.newChats.value)} metric={kpis.newChats} hint={HINTS.newChats} context={vsPrevious(kpis.newChats)} />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title="Mensagens"
        description={`Mensagens a cada ${unit}, enviadas e recebidas.`}
        legend={<SeriesStats items={messageStats} />}
        loading={loading}
        table={<TimeSeriesTable series={data.messages} keys={MESSAGE_KEYS} bucket={range.bucket} caption="Mensagens enviadas e recebidas" />}
      >
        <TimeSeriesChart series={data.messages} keys={MESSAGE_KEYS} type="line" bucket={range.bucket} />
      </ChartCard>

      <NumbersFrame accounts={data.accounts} tz={range.tz} loading={loading} />
    </div>
  );
}

function CampaignsTable({ campaigns, loading }: { campaigns: WhatsappAnalytics["campaigns"]; loading: boolean }) {
  const maxRate = Math.max(...campaigns.map((campaign) => campaign.connectRate ?? 0), 0.0001);
  return (
    <Frame className="lg:col-span-12" aria-busy={loading || undefined}>
      <FrameHeader title="Campanhas de ligação" description="Ligações do período por campanha. Vencimentos hoje são contagens em tempo real." />
      <FramePanel className={cn("p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
        {campaigns.length === 0 ? (
          <p className="px-4 py-8 text-center text-paragraph-sm text-text-sub-600">Nenhuma campanha de ligação ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table.Root>
              <Table.Caption className="sr-only">Campanhas de ligação</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col">Campanha</Table.Head>
                  <Table.Head scope="col" className="text-right">Leads</Table.Head>
                  <Table.Head scope="col" className="text-right">Ligações</Table.Head>
                  <Table.Head scope="col"><span className="sr-only">Tendência</span></Table.Head>
                  <Table.Head scope="col" className="text-right">Conectadas</Table.Head>
                  <Table.Head scope="col">Taxa de conexão</Table.Head>
                  <Table.Head scope="col" className="text-right">Vencem hoje</Table.Head>
                  <Table.Head scope="col" className="w-8"><span className="sr-only">Abrir</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {campaigns.map((campaign) => (
                  <Table.Row key={campaign.id}>
                    <Table.Cell className="h-12">
                      <Link href={`/calling/campaigns/${campaign.id}`} className="block max-w-64 truncate rounded-md text-label-sm text-text-strong-950 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-base">{campaign.name}</Link>
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.leads)}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.calls)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <Sparkline data={campaign.trend} color={WA} className="h-7 w-20" height={28} />
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.connected)}</Table.Cell>
                    <Table.Cell className="h-12">
                      <div className="flex items-center gap-3">
                        <span className="w-12 text-paragraph-sm tabular-nums text-text-strong-950">{formatPercent(campaign.connectRate)}</span>
                        <span aria-hidden="true" className="h-1.5 w-24 rounded-full bg-bg-weak-50">
                          <span className="block h-full rounded-full" style={{ width: `${((campaign.connectRate ?? 0) / maxRate) * 100}%`, backgroundColor: WA }} />
                        </span>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.dueToday)}</Table.Cell>
                    <Table.Cell className="h-12 w-8 text-text-soft-400"><RiArrowRightSLine className="size-4" aria-hidden="true" /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}

function warmUpLabel(iso: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().slice(0, 16).replace("T", " ");
  }
}

function NumbersFrame({ accounts, tz, loading }: { accounts: WhatsappAnalytics["accounts"]; tz: string; loading: boolean }) {
  return (
    <Frame className="lg:col-span-4 lg:self-start" aria-busy={loading || undefined}>
      <FrameHeader title="Números" description="Números de WhatsApp conectados agora." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-8 text-center">
            <RiWhatsappLine className="size-6 text-text-soft-400" aria-hidden="true" />
            <p className="mt-2 text-label-sm text-text-strong-950">Nenhum número conectado</p>
            <p className="mt-0.5 text-paragraph-xs text-text-sub-600">Conecte um número no Unipile e sincronize.</p>
          </div>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {accounts.map((account) => {
              const connected = account.status === "connected";
              const statusLabel = CAMPAIGN_STATUS[account.status.toLowerCase()] ?? account.status.replace(/_/g, " ");
              return (
                <li key={account.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-label-sm text-text-strong-950">{account.name}</p>
                      {account.phone && account.phone.replace(/\D/g, "") !== account.name.replace(/\D/g, "") && <p className="truncate text-paragraph-xs text-text-sub-600">{account.phone}</p>}
                    </div>
                    <StatusDotBadge status={connected ? "good" : "critical"}>{statusLabel}</StatusDotBadge>
                  </div>
                  <CapacityMeter label="Novos chats nas últimas 24 h" used={account.newChats24h} limit={account.newChatLimit} segments={12} />
                  {account.warmingUpUntil && (
                    <p className="flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
                      <RiTimeLine className="size-3.5 shrink-0" aria-hidden="true" style={{ color: STATUS.warning }} />
                      Aquecendo até {warmUpLabel(account.warmingUpUntil, tz)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </FramePanel>
      <FrameFooterLink href="/settings/whatsapp-accounts">Gerenciar números</FrameFooterLink>
    </Frame>
  );
}
