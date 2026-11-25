"use client";

import {
  RiAlarmWarningLine,
  RiArrowRightSLine,
  RiBuilding2Line,
  RiCalendarEventLine,
  RiCheckboxCircleLine,
  RiDraftLine,
  RiGroupLine,
  RiInboxLine,
  RiLinkedinBoxLine,
  RiMailForbidLine,
  RiReplyLine,
  RiSearchLine,
  RiThumbUpLine,
  RiTimerLine,
  RiTrophyLine,
  RiWhatsappLine,
} from "@remixicon/react";
import * as Table from "@/components/alignui/table";
import type { AnalyticsView, OverviewAnalytics } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { ChartCard } from "../kit/ChartCard";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { FunnelChart } from "../kit/FunnelChart";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { ProgressList, type ProgressTone } from "../kit/ProgressList";
import { SectionHeading } from "../kit/SectionHeading";
import { CHANNEL_META, formatCompact, formatMinutes, formatPercent } from "../theme";
import { ConversionCard } from "./ConversionCard";
import { AiAssistantCard, PipelineCard, SentimentCard, StageMovesCard, WorkflowCard } from "./CrmCards";
import type { ViewProps } from "./types";

/**
 * Overview, CRM first: conversation KPIs, replies by sentiment, what needs
 * attention, the pipeline and stage moves, the AI assistant and workflow.
 * Then, smaller, the outreach that fed it: a channel table and the period
 * funnel from first touch to customer.
 */

const HINTS = {
  companies: "Empresas criadas no período.",
  people: "Pessoas criadas no período.",
  analyzed: "Domínios verificados pelas campanhas de qualificação no período.",
  qualified: "Domínios que passaram na qualificação no período.",
  opportunities: "Registros com interesse ou cliente que não estão encerrados no CRM.",
  replies: "Mensagens recebidas nas conversas do CRM no período, em qualquer canal.",
  positive: "Registros do CRM movidos para Interessado ou Cliente no período.",
  meetings: "Registros do CRM movidos para uma etapa de reunião ou demonstração no período. Não comparecimentos não entram.",
  customers: "Registros do CRM movidos para Cliente no período.",
  response: "Tempo mediano entre a mensagem do lead e a sua próxima resposta na conversa.",
};

export function OverviewView({ data, loading, onSelectView }: ViewProps<"overview">) {
  const { kpis, range, crm, commercial } = data;
  const vsPrevious = (m: { previous: number | null }) => (m.previous === null ? undefined : `vs ${formatCompact(m.previous)} no período anterior`);
  const replySpark = crm.repliesByCategory.points.map((point) => crm.repliesByCategory.keys.reduce((sum, key) => sum + point[key], 0));
  const response = crm.kpis.medianFirstResponseMinutes;
  const qualificationRate = commercial.analyzedDomains.inRange.value > 0 ? commercial.qualifiedDomains.inRange.value / commercial.analyzedDomains.inRange.value : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <SectionHeading className="lg:col-span-12" title="Base comercial" description="Empresas, pessoas e domínios que alimentaram a operação." />
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiBuilding2Line} label="Empresas" value={formatCompact(commercial.companies.new.value)} metric={commercial.companies.new} hint={HINTS.companies} context={`${formatCompact(commercial.companies.total)} no total`} />
        <KpiCell icon={RiGroupLine} label="Pessoas" value={formatCompact(commercial.people.new.value)} metric={commercial.people.new} hint={HINTS.people} context={`${formatCompact(commercial.people.total)} no total`} />
        <KpiCell icon={RiSearchLine} label="Domínios analisados" value={formatCompact(commercial.analyzedDomains.inRange.value)} metric={commercial.analyzedDomains.inRange} hint={HINTS.analyzed} context={`${formatCompact(commercial.analyzedDomains.total)} no total`} />
        <KpiCell icon={RiCheckboxCircleLine} label="Domínios qualificados" value={formatCompact(commercial.qualifiedDomains.inRange.value)} metric={commercial.qualifiedDomains.inRange} hint={HINTS.qualified} context={qualificationRate === null ? `${formatCompact(commercial.qualifiedDomains.total)} no total` : `${formatPercent(qualificationRate)} dos analisados`} />
        <KpiCell icon={RiTrophyLine} label="Oportunidades abertas" value={formatCompact(commercial.opportunities)} hint={HINTS.opportunities} context="agora, no CRM" />
      </KpiStrip>

      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiReplyLine} label="Respostas" value={formatCompact(crm.kpis.replies.value)} metric={crm.kpis.replies} hint={HINTS.replies} context={`de ${formatCompact(kpis.replied.value)} ${kpis.replied.value === 1 ? "pessoa" : "pessoas"}`} spark={replySpark} />
        <KpiCell icon={RiThumbUpLine} label="Positivos" value={formatCompact(kpis.positive.value)} metric={kpis.positive} hint={HINTS.positive} context={kpis.replied.value > 0 ? `${formatPercent(kpis.positive.value / kpis.replied.value)} de quem respondeu` : vsPrevious(kpis.positive)} />
        <KpiCell icon={RiCalendarEventLine} label="Reuniões" value={formatCompact(kpis.meetings.value)} metric={kpis.meetings} hint={HINTS.meetings} context={vsPrevious(kpis.meetings)} />
        <KpiCell icon={RiTrophyLine} label="Clientes" value={formatCompact(kpis.customers.value)} metric={kpis.customers} hint={HINTS.customers} context={vsPrevious(kpis.customers)} />
        <KpiCell icon={RiTimerLine} label="Tempo de 1ª resposta" value={formatMinutes(response.value)} metric={response} upIsGood={false} hint={HINTS.response} context={response.previous === null ? undefined : `vs ${formatMinutes(response.previous)} no período anterior`} />
      </KpiStrip>

      <SentimentCard className="lg:col-span-8" series={crm.repliesByCategory} bucket={range.bucket} loading={loading} />
      <AttentionCard attention={data.attention} loading={loading} />

      <PipelineCard className="lg:col-span-6 lg:self-start" value={crm.pipeline} loading={loading} />
      <div className="flex flex-col gap-4 lg:col-span-6 lg:gap-5">
        <StageMovesCard value={crm.stageEntries} loading={loading} />
        <WorkflowCard value={crm.workflow} loading={loading} />
      </div>

      <AiAssistantCard className="lg:col-span-12" crm={crm} loading={loading} />

      <ConversionCard className="lg:col-span-12" value={data.conversion} loading={loading} />

      <SectionHeading className="mt-2 lg:col-span-12" title="Canais" description="De onde vieram essas conversas. Abra um canal para ver o detalhe." />
      <ChannelTable data={data} loading={loading} onSelectView={onSelectView} />
      <ChartCard className="lg:col-span-4" title="Funil de conversão" description="Do primeiro contato até Cliente." loading={loading} footer="Contagens do período — não é o acompanhamento de uma única coorte.">
        <FunnelChart stages={data.funnel} />
      </ChartCard>
    </div>
  );
}

function ChannelTable({ data, loading, onSelectView }: { data: OverviewAnalytics; loading: boolean; onSelectView?: (view: AnalyticsView) => void }) {
  const maxRate = Math.max(...data.channels.map((c) => c.replyRate ?? 0), 0.0001);
  return (
    <Frame className="lg:col-span-8">
      <FrameHeader title="Canais" description="Desempenho de cada canal no período. Selecione uma linha para abrir o detalhe." />
      <FramePanel className={cn("p-2 transition-opacity sm:p-3", loading && "opacity-60")}>
      <Table.Root>
        <Table.Caption className="sr-only">Channel comparison</Table.Caption>
        <Table.Header>
          <Table.Row>
            <Table.Head scope="col">Canal</Table.Head>
            <Table.Head scope="col" className="text-right">Alcançados</Table.Head>
            <Table.Head scope="col" className="text-right">Responderam</Table.Head>
            <Table.Head scope="col">Taxa de resposta</Table.Head>
            <Table.Head scope="col" className="text-right">Positivos</Table.Head>
            <Table.Head scope="col" className="w-8"><span className="sr-only">Abrir</span></Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body spacing={4}>
          {data.channels.map((row) => {
            const meta = CHANNEL_META[row.channel];
            const Icon = meta.icon;
            return (
              <Table.Row key={row.channel} className="cursor-pointer" onClick={() => onSelectView?.(row.channel)}>
                <Table.Cell className="h-12">
                  <button type="button" onClick={(e) => { e.stopPropagation(); onSelectView?.(row.channel); }} className="flex items-center gap-2.5 rounded-md text-label-sm text-text-strong-950 outline-none focus-visible:ring-2 focus-visible:ring-primary-base">
                    <span className="flex size-6 items-center justify-center rounded-md" style={{ backgroundColor: meta.color }}>
                      <Icon className="size-4 text-white" />
                    </span>
                    {meta.label}
                  </button>
                </Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(row.reached)}</Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(row.replied)}</Table.Cell>
                <Table.Cell className="h-12">
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-paragraph-sm tabular-nums text-text-strong-950">{formatPercent(row.replyRate)}</span>
                    <span aria-hidden="true" className="h-1.5 w-24 rounded-full bg-bg-weak-50">
                      <span className="block h-full rounded-full" style={{ width: `${((row.replyRate ?? 0) / maxRate) * 100}%`, backgroundColor: meta.color }} />
                    </span>
                  </div>
                </Table.Cell>
                <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(row.positive)}</Table.Cell>
                <Table.Cell className="h-12 w-8 text-text-soft-400"><RiArrowRightSLine className="size-4" aria-hidden="true" /></Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
      </FramePanel>
    </Frame>
  );
}

type AttentionItem = { key: keyof OverviewAnalytics["attention"]; label: string; hint: string; href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; tone: ProgressTone };

const ATTENTION: AttentionItem[] = [
  { key: "actionRequired", label: "Ações necessárias", hint: "Conversas aguardando você", href: "/crm/actions", icon: RiInboxLine, tone: "serious" },
  { key: "overdue", label: "Follow-ups vencidos", hint: "Follow-ups em rascunho ou passando do horário", href: "/crm/actions", icon: RiAlarmWarningLine, tone: "critical" },
  { key: "draftsAwaitingReview", label: "Rascunhos para revisar", hint: "Respostas da IA aguardando aprovação", href: "/crm/actions", icon: RiDraftLine, tone: "warning" },
  { key: "mailboxesFailing", label: "Caixas com falha", hint: "Contas de e-mail que não conseguem enviar", href: "/settings/email-accounts", icon: RiMailForbidLine, tone: "critical" },
  { key: "linkedinDisconnected", label: "LinkedIn desconectado", hint: "Contas que precisam ser reconectadas", href: "/settings/linkedin-accounts", icon: RiLinkedinBoxLine, tone: "critical" },
  { key: "whatsappDisconnected", label: "WhatsApp desconectado", hint: "Números que precisam ser religados", href: "/settings/whatsapp-accounts", icon: RiWhatsappLine, tone: "critical" },
];

function AttentionCard({ attention, loading }: { attention: OverviewAnalytics["attention"]; loading: boolean }) {
  const anyOpen = ATTENTION.some((item) => attention[item.key] > 0);
  return (
    <Frame className="lg:col-span-4">
      <FrameHeader title="Precisa de atenção" description="Agora, independentemente do período selecionado." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        {anyOpen ? (
          <ProgressList
            items={ATTENTION.map((item) => ({
              key: item.key,
              label: item.label,
              value: attention[item.key],
              subline: item.hint,
              tone: attention[item.key] > 0 ? item.tone : "neutral",
              icon: attention[item.key] > 0 ? item.icon : undefined,
              href: item.href,
            }))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <RiCheckboxCircleLine className="size-6 text-success-base" aria-hidden="true" />
            <p className="mt-2 text-label-sm text-text-strong-950">Tudo em dia</p>
            <p className="mt-0.5 text-paragraph-xs text-text-sub-600">Nenhuma resposta pendente ou conta com falha.</p>
          </div>
        )}
      </FramePanel>
    </Frame>
  );
}
