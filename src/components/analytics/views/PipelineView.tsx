"use client";

import { RiBuilding2Line, RiCalendarEventLine, RiCheckboxCircleLine, RiReplyLine, RiTrophyLine } from "@remixicon/react";
import { ratio } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RankedList, type RankedItem } from "../kit/RankedList";
import { formatCompact, formatDay, formatPercent, formatTime } from "../theme";
import { ConversionCard } from "./ConversionCard";
import { AiAssistantCard, PipelineCard, SentimentCard, StageMovesCard, WorkflowCard } from "./CrmCards";
import type { ViewProps } from "./types";

export function PipelineView({ data, loading }: ViewProps<"pipeline">) {
  const { kpis, commercial, crm, range } = data;
  const dim = cn(loading && "opacity-60");
  const qualificationRate = ratio(commercial.qualifiedDomains.inRange.value, commercial.analyzedDomains.inRange.value);

  const meetings: RankedItem[] = data.upcomingMeetings.map((meeting) => ({
    key: meeting.id,
    label: meeting.personName,
    sublabel: [formatDay(meeting.startAt.slice(0, 10)), meeting.companyName].filter(Boolean).join(" · "),
    value: formatTime(meeting.startAt),
    subvalue: `${formatTime(meeting.startAt)} – ${formatTime(meeting.endAt)}`,
    icon: RiCalendarEventLine,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiCalendarEventLine} label="Reuniões" value={formatCompact(kpis.meetings.value)} metric={kpis.meetings} context="no período" hint="Registros movidos para uma etapa de reunião ou demonstração." />
        <KpiCell icon={RiTrophyLine} label="Clientes" value={formatCompact(kpis.customers.value)} metric={kpis.customers} context="no período" hint="Registros movidos para Cliente no período." />
        <KpiCell icon={RiBuilding2Line} label="Oportunidades abertas" value={formatCompact(commercial.opportunities)} context="agora, no CRM" hint="Registros com interesse ou cliente que não estão encerrados." />
        <KpiCell icon={RiCheckboxCircleLine} label="Taxa de qualificação" value={formatPercent(qualificationRate)} context={`${formatCompact(commercial.qualifiedDomains.inRange.value)} de ${formatCompact(commercial.analyzedDomains.inRange.value)} domínios`} hint="Domínios qualificados divididos pelos domínios analisados no período." />
        <KpiCell icon={RiReplyLine} label="Próximas reuniões" value={formatCompact(data.upcomingMeetings.length)} context="agendadas" hint="Reuniões futuras com data marcada e sem desfecho registrado." />
      </KpiStrip>

      <SentimentCard className="lg:col-span-8" series={crm.repliesByCategory} bucket={range.bucket} loading={loading} />
      <Frame className="lg:col-span-4">
        <FrameHeader title="Próximas reuniões" description="Agenda comercial dos próximos encontros." />
        <FramePanel className={dim}>
          <RankedList items={meetings} emptyLabel="Nenhuma reunião agendada." />
        </FramePanel>
      </Frame>

      <PipelineCard className="lg:col-span-6" value={crm.pipeline} loading={loading} />
      <StageMovesCard className="lg:col-span-6" value={crm.stageEntries} loading={loading} />

      <WorkflowCard className="lg:col-span-6" value={crm.workflow} loading={loading} />
      <AiAssistantCard className="lg:col-span-6" crm={crm} loading={loading} />

      <ConversionCard className="lg:col-span-12" value={data.conversion} loading={loading} />
    </div>
  );
}
