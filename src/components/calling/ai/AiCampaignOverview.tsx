"use client";

import {
  RiCalendarCheckLine,
  RiChat1Line,
  RiCheckboxCircleLine,
  RiCustomerService2Line,
  RiErrorWarningLine,
  RiHourglassLine,
  RiPhoneLine,
  RiPercentLine,
  RiStarLine,
  RiStopCircleLine,
  RiTeamLine,
  RiThumbDownLine,
} from "@remixicon/react";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { ChartCard } from "@/components/analytics/kit/ChartCard";
import { ChartLegend } from "@/components/analytics/kit/ChartLegend";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "@/components/analytics/kit/TimeSeriesChart";
import { CHANNEL_META, formatCompact, formatPercent, HUE, MUTED, STATUS } from "@/components/analytics/theme";
import { Skeleton } from "@/components/page/Skeletons";
import { AGENT_OUTCOMES } from "@/lib/calls/contract";
import type { AiCampaignDetail, AiCampaignStats } from "@/lib/calls/aiCampaigns/api";
import { AI_OUTCOME_LABELS_PT, aiStepLabelPt } from "./aiShared";

const WA = CHANNEL_META.whatsapp.color;
const DAY_KEYS: SeriesKeys<"answered" | "unanswered"> = {
  answered: { label: "Atendidas", color: WA },
  unanswered: { label: "Não atendidas", color: MUTED },
};
const OUTCOME_COLOR: Record<(typeof AGENT_OUTCOMES)[number], string> = {
  meeting_booked: HUE.green,
  interested: HUE.teal,
  human_callback: HUE.sky,
  call_back: HUE.blue,
  not_interested: HUE.red,
  wrong_person: HUE.orange,
  do_not_contact: HUE.red,
  no_response: MUTED,
  other: MUTED,
};

const pct = (part: number, whole: number): string | undefined => (whole > 0 ? formatPercent(part / whole) : undefined);

/** The Overview tab: headline numbers for the team, where leads stand, the per-step funnel, outcomes and calls per day. */
export function AiCampaignOverview({ campaign, stats }: { campaign: AiCampaignDetail; stats: AiCampaignStats | null }) {
  if (!stats) {
    return (
      <div aria-busy="true" aria-label="Carregando" className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  const s = stats;
  const inProgress = s.byStatus.queued + s.byStatus.reaching + s.byStatus.callback;
  const leadStates: DonutItem[] = [
    { key: "progress", label: "Em andamento", value: inProgress, color: HUE.amber, icon: RiHourglassLine },
    { key: "chasing", label: "Aguardando agendamento", value: s.byStatus.chasing, color: HUE.purple, icon: RiCalendarCheckLine },
    { key: "booked", label: "Reunião agendada", value: s.byStatus.booked, color: STATUS.good, icon: RiCheckboxCircleLine },
    { key: "team", label: "Para a equipe", value: s.byStatus.handoff + s.byStatus.replied, color: HUE.teal, icon: RiCustomerService2Line },
    { key: "no", label: "Não interessado", value: s.byStatus.not_interested, color: MUTED, icon: RiThumbDownLine },
    { key: "ended", label: "Não abordado, interrompido ou com falha", value: s.byStatus.unreached + s.byStatus.stopped + s.byStatus.failed, color: STATUS.critical, icon: RiStopCircleLine },
  ];

  const reachSteps = s.perStep.filter((step) => step.phase === "reach");
  const chaseSteps = s.perStep.filter((step) => step.phase !== "reach");
  const outcomes: BarListItem[] = AGENT_OUTCOMES.filter((key) => (s.outcomes[key] ?? 0) > 0).map((key) => ({
    key,
    label: AI_OUTCOME_LABELS_PT[key],
    value: s.outcomes[key] ?? 0,
    color: OUTCOME_COLOR[key],
  }));
  const series = {
    keys: ["answered", "unanswered"] as const,
    points: s.callsByDay.map((day) => ({ date: day.date, answered: day.answered, unanswered: Math.max(day.placed - day.answered, 0) })),
  };
  const limit = campaign.callsPerDayLimit;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiTeamLine} label="Leads" value={formatCompact(s.total)} context={s.byStatus.queued > 0 ? `${formatCompact(s.byStatus.queued)} ainda sem ligação` : s.total > 0 ? "Todos já foram abordados" : undefined} />
        <KpiCell
          icon={RiPhoneLine}
          label="Ligações hoje"
          value={`${formatCompact(s.callsToday)}${limit > 0 ? ` / ${formatCompact(limit)}` : ""}`}
          context={`${formatCompact(s.callsPlaced)} feitas no total`}
          hint="Ligações feitas hoje pela campanha, comparadas com o máximo que seus números podem fazer por dia (limite de cada número ou regra de envio; um número ainda em aquecimento faz menos)."
        />
        <KpiCell icon={RiPercentLine} label="Atendidas" value={formatPercent(s.callsPlaced > 0 ? s.callsAnswered / s.callsPlaced : null)} context={s.callsPlaced > 0 ? `${s.callsAnswered.toLocaleString("pt-BR")} de ${s.callsPlaced.toLocaleString("pt-BR")} ligações` : "Nenhuma ligação ainda"} hint="Ligações atendidas e registradas." />
        <KpiCell icon={RiChat1Line} label="Conversas" value={formatCompact(s.conversations)} context={pct(s.conversations, s.callsPlaced) ? `${pct(s.conversations, s.callsPlaced)} das ligações` : undefined} hint="Ligações em que o lead realmente conversou. Atender e não dizer nada não conta." />
        <KpiCell icon={RiStarLine} label="Interessados" value={formatCompact(s.interested)} context={pct(s.interested, s.conversations) ? `${pct(s.interested, s.conversations)} das conversas` : undefined} hint="Leads que terminaram a ligação interessados, com reunião combinada ou querendo que a equipe ligue." />
        <KpiCell icon={RiCalendarCheckLine} label="Agendadas" value={formatCompact(s.booked)} context={s.handoffs > 0 ? `${formatCompact(s.handoffs)} encaminhados à equipe` : s.messagesSent > 0 ? `${formatCompact(s.messagesSent)} mensagens enviadas` : undefined} hint="Reuniões informadas pelo Cal.com. Leads encaminhados à equipe estão em Ação necessária." />
      </KpiStrip>

      <Frame className="self-start lg:col-span-5">
        <FrameHeader title="Onde os leads estão" description="Todos os leads, pela situação atual." />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel="leads" emptyLabel="Ainda sem leads" emptyDescription="Adicione leads para ver em que etapa estão." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-7">
        <FrameHeader title="Funil de abordagem" description="Quantos leads chegaram a cada etapa da sequência." />
        <FramePanel>
          {reachSteps.some((step) => step.attempted > 0) ? (
            <FunnelChart stages={reachSteps.map((step) => ({ key: step.key, label: aiStepLabelPt(step.label), value: step.attempted }))} />
          ) : (
            <p className="py-6 text-center text-paragraph-sm text-text-sub-600">Nenhuma etapa foi executada ainda.</p>
          )}
          {chaseSteps.some((step) => step.attempted > 0) && (
            <div className="mt-5 border-t border-stroke-soft-200 pt-4">
              <p className="mb-3 text-label-sm text-text-strong-950">Depois do sim, antes do agendamento</p>
              <BarList items={chaseSteps.filter((step) => step.attempted > 0).map((step) => ({ key: step.key, label: aiStepLabelPt(step.label), value: step.attempted, color: HUE.purple }))} />
            </div>
          )}
        </FramePanel>
      </Frame>

      <ChartCard
        className="lg:col-span-8"
        title="Ligações por dia"
        description="Ligações feitas por dia nos últimos 14 dias, atendidas ou não."
        legend={<ChartLegend items={[{ label: DAY_KEYS.answered.label, color: DAY_KEYS.answered.color }, { label: DAY_KEYS.unanswered.label, color: DAY_KEYS.unanswered.color }]} />}
        table={<TimeSeriesTable series={series} keys={DAY_KEYS} bucket="day" caption="Ligações por dia" />}
      >
        <TimeSeriesChart series={series} keys={DAY_KEYS} type="stackedBar" bucket="day" />
      </ChartCard>

      <Frame className="self-start lg:col-span-4">
        <FrameHeader title="O que o agente ouviu" description="Como terminou cada conversa registrada." />
        <FramePanel>
          <BarList items={outcomes} emptyLabel="Nenhuma conversa ainda." />
          {s.callsPlaced > s.callsAnswered && (
            <p className="mt-4 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
              <RiErrorWarningLine className="size-3.5 shrink-0" aria-hidden="true" />
              {(s.callsPlaced - s.callsAnswered).toLocaleString("pt-BR")} ligações não foram atendidas ou não foram registradas.
            </p>
          )}
        </FramePanel>
      </Frame>
    </div>
  );
}
