"use client";

import {
  RiChat1Line,
  RiCheckboxCircleLine,
  RiCheckDoubleLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiReplyLine,
  RiSendPlaneLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { ChartCard } from "@/components/analytics/kit/ChartCard";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { SeriesStats } from "@/components/analytics/kit/SeriesStats";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "@/components/analytics/kit/TimeSeriesChart";
import { Skeleton } from "@/components/page/Skeletons";
import { CHANNEL_META, formatCompact, formatPercent, MUTED, STATUS } from "@/components/analytics/theme";
import type { CampaignFunnel } from "./metrics";

/**
 * A LinkedIn campaign's Overview: headline numbers, the invited → accepted →
 * replied funnel, the last 7 days of invitations and accepts (grouped bars —
 * seven discrete daily counts), where every
 * lead stands now (a donut — the states are exclusive and sum to the leads),
 * and how far accepted leads have got through the follow-ups.
 *
 * Colours follow the Analytics LinkedIn view: invites wear the channel blue,
 * accepts violet. Lead states reuse the send-campaign donut's slots so the
 * two campaign pages read alike.
 */

const LINKEDIN = CHANNEL_META.linkedin.color;

export type ChartDay = { date: string; invitations: number; accepted: number };

type ActivityKey = "invites" | "accepted";
const ACTIVITY_KEYS: SeriesKeys<ActivityKey> = {
  invites: { label: "Convites enviados", color: LINKEDIN },
  accepted: { label: "Aceitos", color: "#7d52f4" },
};

/**
 * The chart-data route labels its seven days "Sep 24" (today last); the kit
 * wants YYYY-MM-DD. The days are consecutive and end today, so the position
 * gives the date without parsing the label.
 */
function toSeries(days: ChartDay[]) {
  const today = new Date();
  const points = days.map((day, i) => {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days.length - 1 - i));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date: iso, invites: day.invitations, accepted: day.accepted };
  });
  return { keys: ["invites", "accepted"] as const, points };
}

function pct(part: number, whole: number): string | undefined {
  return whole > 0 ? formatPercent(part / whole) : undefined;
}

export function CampaignOverview({
  funnel: f,
  statusCounts: s,
  chartData,
}: {
  funnel: CampaignFunnel;
  statusCounts: Record<string, number>;
  /** null while the 7-day activity is loading. */
  chartData: ChartDay[] | null;
}) {
  const series = toSeries(chartData ?? []);
  const activityStats = (Object.keys(ACTIVITY_KEYS) as ActivityKey[]).map((k) => ({
    label: ACTIVITY_KEYS[k].label,
    color: ACTIVITY_KEYS[k].color,
    value: chartData ? formatCompact(seriesTotal(series, k)) : "—",
  }));

  const leadStates: DonutItem[] = [
    { key: "queued", label: "Ainda não convidados", value: f.queued, color: MUTED, icon: RiTimeLine },
    { key: "awaiting", label: "Aguardando aceite", value: f.awaiting, color: LINKEDIN, icon: RiSendPlaneLine },
    { key: "inSequence", label: "Em sequência", value: f.inSequence, color: "#e5930a", icon: RiLoader4Line },
    { key: "completed", label: "Concluído, sem resposta", value: f.completed, color: STATUS.good, icon: RiCheckboxCircleLine },
    { key: "replied", label: "Responderam", value: f.replied, color: "#7d52f4", icon: RiReplyLine },
    { key: "failed", label: "Falhou ou cancelado", value: f.failed + f.cancelled, color: STATUS.critical, icon: RiErrorWarningLine },
  ];

  const n = (key: string) => s[key] ?? 0;
  const sequenceSteps: BarListItem[] = [
    { key: "CONNECTED", label: "Conectado, mensagem não enviada", value: n("CONNECTED") },
    { key: "ACCEPT_MESSAGE_SENT", label: "Mensagem de aceite enviada", value: n("ACCEPT_MESSAGE_SENT") },
    { key: "FOLLOW_UP_1_SENT", label: "Acompanhamento 1 enviado", value: n("FOLLOW_UP_1_SENT") },
    { key: "FOLLOW_UP_2_SENT", label: "Acompanhamento 2 enviado", value: n("FOLLOW_UP_2_SENT") },
    { key: "FOLLOW_UP_3_SENT", label: "Acompanhamento 3 enviado", value: n("FOLLOW_UP_3_SENT") },
    { key: "COMPLETED", label: "Sequência concluída, sem resposta", value: n("COMPLETED") },
    { key: "REPLIED", label: "Responderam", value: n("REPLIED") },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiTeamLine} label="Leads" value={formatCompact(f.total)} context={f.queued > 0 ? `${formatCompact(f.queued)} ainda não convidados` : "Todos foram convidados"} />
        <KpiCell icon={RiSendPlaneLine} label="Convidados" value={formatCompact(f.invited)} context={pct(f.invited, f.total) ? `${pct(f.invited, f.total)} dos leads` : undefined} hint="Leads que receberam convite, independentemente do resultado." />
        <KpiCell icon={RiCheckDoubleLine} label="Aceitos" value={formatCompact(f.accepted)} context={f.acceptanceRate !== null ? `taxa de aceite de ${formatPercent(f.acceptanceRate)}` : undefined} hint="Leads que aceitaram o convite. A taxa de aceite é aceitos ÷ convidados." />
        <KpiCell icon={RiChat1Line} label="Respostas" value={formatCompact(f.replied)} context={f.replyRate !== null ? `${formatPercent(f.replyRate)} dos aceitos` : undefined} hint="Leads que responderam. A taxa de resposta é respostas ÷ aceitos, como em Analytics." />
        <KpiCell icon={RiErrorWarningLine} label="Falhas" value={formatCompact(f.failed)} context={f.cancelled > 0 ? `${formatCompact(f.cancelled)} cancelados` : f.failed > 0 ? "Convites que não puderam ser enviados" : "Nenhuma"} hint="Leads cujo convite não pôde ser enviado após todas as tentativas." />
      </KpiStrip>

      <ChartCard
        className="lg:col-span-8"
        title="Atividade"
        description="Convites enviados e conexões aceitas por dia nos últimos 7 dias."
        loading={chartData === null}
        legend={<SeriesStats items={activityStats} />}
        table={<TimeSeriesTable series={series} keys={ACTIVITY_KEYS} bucket="day" caption="Convites e aceites por dia" />}
      >
        {chartData === null ? (
          <Skeleton className="h-[260px] w-full rounded-xl" />
        ) : (
          <TimeSeriesChart series={series} keys={ACTIVITY_KEYS} type="bar" bucket="day" />
        )}
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title="Funil" description="Convidados → aceitos → respostas." />
        <FramePanel>
          <FunnelChart
            stages={[
              { key: "invited", label: "Convidados", value: f.invited },
              { key: "accepted", label: "Aceitos", value: f.accepted },
              { key: "replied", label: "Respostas", value: f.replied },
            ]}
          />
        </FramePanel>
        <FrameFooter>Todos os leads desta campanha, pelo estágio alcançado. Desde sempre.</FrameFooter>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Situação dos leads" description="Todos os leads da campanha, pelo estágio atual." />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel="leads" emptyLabel="Nenhum lead ainda" emptyDescription="Adicione leads para ver a situação." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Progresso da sequência" description="Leads aceitos, pela última etapa enviada." />
        <FramePanel>
          <BarList items={f.accepted > 0 ? sequenceSteps : []} emptyLabel="Nenhuma conexão aceita ainda." />
        </FramePanel>
      </Frame>
    </div>
  );
}
