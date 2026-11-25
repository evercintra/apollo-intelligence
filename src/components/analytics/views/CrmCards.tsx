"use client";

import { RiCheckDoubleLine, RiDraftLine } from "@remixicon/react";
import type { CrmCategory, CrmSummary } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { BarList, type BarListItem } from "../kit/BarList";
import { ChartCard } from "../kit/ChartCard";
import { DeltaPill } from "../kit/DeltaPill";
import { DonutChart, type DonutItem } from "../kit/DonutChart";
import { EmptyChart } from "../kit/EmptyChart";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { SegmentedBar, type SegmentItem } from "../kit/SegmentedBar";
import { SeriesStats } from "../kit/SeriesStats";
import { seriesTotal, TimeSeriesChart, TimeSeriesTable, type SeriesKeys } from "../kit/TimeSeriesChart";
import { APOLLO_RAMP, CRM_CATEGORY_COLOR, formatCompact, formatPercent, MUTED, ordinalRamp, STATUS } from "../theme";

/**
 * The CRM cards of the Overview: replies by sentiment, the pipeline shape,
 * stage moves, the AI assistant and workflow states.
 *
 * Colour: CRM categories carry one fixed identity colour everywhere — the
 * sentiment chart, the pipeline and stage-move donuts, the top-stage bars —
 * (categorical slots 6, 7, 8, 4 and gray), none of them a channel colour.
 * Funnel stages use the ordinal blue ramp by stage rank.
 */

export const CATEGORY_LABEL: Record<CrmCategory, string> = { interested: "Interessado", customer: "Cliente", not_interested: "Não interessado", other: "Outro", unclassified: "Sem classificação" };
const SENTIMENT_KEYS: SeriesKeys<CrmCategory> = {
  interested: { label: CATEGORY_LABEL.interested, color: CRM_CATEGORY_COLOR.interested },
  customer: { label: CATEGORY_LABEL.customer, color: CRM_CATEGORY_COLOR.customer },
  not_interested: { label: CATEGORY_LABEL.not_interested, color: CRM_CATEGORY_COLOR.not_interested },
  other: { label: CATEGORY_LABEL.other, color: CRM_CATEGORY_COLOR.other },
  unclassified: { label: CATEGORY_LABEL.unclassified, color: MUTED },
};

type CardProps<K extends keyof CrmSummary> = { value: CrmSummary[K]; loading: boolean; className?: string };

export function SentimentCard({ series, bucket, loading, className }: { series: CrmSummary["repliesByCategory"]; bucket: "day" | "week"; loading: boolean; className?: string }) {
  const stats = (Object.keys(SENTIMENT_KEYS) as CrmCategory[]).map((k) => ({ label: SENTIMENT_KEYS[k].label, color: SENTIMENT_KEYS[k].color, value: formatCompact(seriesTotal(series, k)) }));
  return (
    <ChartCard
      className={className}
      title="Respostas por sentimento"
      description={`Respostas recebidas a cada ${bucket === "day" ? "dia" : "semana"}, pela categoria atribuída.`}
      legend={<SeriesStats items={stats} />}
      loading={loading}
      table={<TimeSeriesTable series={series} keys={SENTIMENT_KEYS} bucket={bucket} caption="Respostas por sentimento" />}
    >
      <TimeSeriesChart series={series} keys={SENTIMENT_KEYS} type="stackedBar" bucket={bucket} />
    </ChartCard>
  );
}

/** Category order for every CRM donut: validated adjacent-pair palette, gray last. */
const CATEGORY_ORDER: CrmCategory[] = ["interested", "customer", "not_interested", "other", "unclassified"];

function byCategory(rows: Array<{ categoryKey: CrmCategory; value: number }>): DonutItem[] {
  const totals = new Map<CrmCategory, number>();
  for (const r of rows) totals.set(r.categoryKey, (totals.get(r.categoryKey) ?? 0) + r.value);
  return CATEGORY_ORDER.map((k) => ({ key: k, label: CATEGORY_LABEL[k], value: totals.get(k) ?? 0, color: SENTIMENT_KEYS[k].color }));
}

/** A small uppercase label between a card's donut and its list. */
function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 mt-5 border-t border-stroke-soft-200 pt-4 text-subheading-2xs uppercase text-text-soft-400">{children}</h3>;
}

export function PipelineCard({ value: pipeline, loading, className }: CardProps<"pipeline">) {
  const ranked = pipeline.filter((p) => p.stageRank !== null);
  const ramp = ordinalRamp(Math.max(ranked.length, 1));
  const stages: BarListItem[] = ranked.map((p, i) => ({ key: `r-${p.subcategoryId ?? i}`, label: `${p.name} · ${CATEGORY_LABEL[p.categoryKey]}`, value: p.count, color: ramp[i] }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title="Pipeline atual" description="Registros abertos por categoria agora e o quanto avançaram no funil." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={byCategory(pipeline.map((p) => ({ categoryKey: p.categoryKey, value: p.count })))} centerLabel="registros abertos" emptyLabel="Nenhum registro aberto" emptyDescription="Não há registros abertos no CRM neste momento." />
        {stages.length > 0 && (
          <>
            <SubHeading>Etapas do funil · mais escuras conforme avançam</SubHeading>
            <BarList items={stages} />
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

export function StageMovesCard({ value: entries, loading, className }: CardProps<"stageEntries">) {
  const moved = entries.filter((e) => e.entered > 0);
  const top: BarListItem[] = [...moved]
    .sort((a, b) => b.entered - a.entered)
    .slice(0, 5)
    .map((e) => ({ key: e.subcategoryId, label: `${e.name} · ${CATEGORY_LABEL[e.categoryKey]}`, value: e.entered, color: SENTIMENT_KEYS[e.categoryKey].color }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title="Movimentações de etapa" description="Registros que entraram em uma nova etapa, pela categoria de destino." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={byCategory(moved.map((e) => ({ categoryKey: e.categoryKey, value: e.entered })))} centerLabel="movimentações" emptyLabel="Nenhuma movimentação" />
        {top.length > 0 && (
          <>
            <SubHeading>Etapas mais movimentadas</SubHeading>
            <BarList items={top} />
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

/**
 * Workflow states in a fixed order with fixed colours: adjacent pairs pass the
 * CVD check (pink sits beside amber, never beside teal, which it can't be told
 * apart from with deuteranopia).
 * Idle and the not-yet-classified states are neutral grays.
 */
const WORKFLOW_META: Record<string, { label: string; color: string }> = {
  paused: { label: "Pausado", color: "#B05A8A" },
  action_required: { label: "Ação necessária", color: STATUS.warning },
  error: { label: "Erro", color: STATUS.critical },
  waiting: { label: "Aguardando", color: "#6F5A85" },
  closed: { label: "Encerrado", color: STATUS.good },
  unclassified: { label: "Sem classificação", color: "var(--chart-muted-strong)" },
  classifying: { label: "Classificando", color: "var(--chart-muted-strong)" },
  idle: { label: "Parado", color: MUTED },
};

export function WorkflowCard({ value: workflow, loading, className }: CardProps<"workflow">) {
  const order = Object.keys(WORKFLOW_META);
  const items: DonutItem[] = [...workflow]
    .sort((a, b) => (order.indexOf(a.key) + 1 || 99) - (order.indexOf(b.key) + 1 || 99))
    .map((w) => ({ key: w.key, label: WORKFLOW_META[w.key]?.label ?? w.label, value: w.value, color: WORKFLOW_META[w.key]?.color ?? MUTED }));
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader title="Fluxo de trabalho" description="Todos os registros por estado de fluxo, agora." />
      <FramePanel className={cn("transition-opacity", loading && "opacity-60")}>
        <DonutChart items={items} centerLabel="registros" emptyLabel="Nenhum registro ainda" emptyDescription="Registros aparecem quando um lead responde." />
      </FramePanel>
    </Frame>
  );
}

/** One figure in the AI card's stat row. */
function AiStat({ label, value, metric, upIsGood, note }: { label: string; value: string; metric?: { value: number | null; previous: number | null }; upIsGood?: boolean; note: string }) {
  return (
    <div className="min-w-0 bg-bg-white-0 px-4 py-3 first:pl-0 last:pr-0">
      <p className="truncate text-paragraph-xs text-text-sub-600">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-title-h6 font-semibold leading-none tracking-tight text-text-strong-950">{value}</p>
        {metric && <DeltaPill metric={metric} upIsGood={upIsGood} />}
      </div>
      <p className="mt-1.5 truncate text-paragraph-xs text-text-soft-400">{note}</p>
    </div>
  );
}

/** Drafts and classification: how much of the AI's work goes out as written. */
export function AiAssistantCard({ crm, loading, className }: { crm: CrmSummary; loading: boolean; className?: string }) {
  const { drafts, kpis } = crm;
  const sent = drafts.sentAsIs + drafts.sentEdited;
  const items: SegmentItem[] = [
    { key: "asIs", label: "Enviado sem edição", value: drafts.sentAsIs, color: APOLLO_RAMP[5] },
    { key: "edited", label: "Enviado editado", value: drafts.sentEdited, color: APOLLO_RAMP[0] },
    { key: "discarded", label: "Descartado", value: drafts.discarded, color: MUTED },
  ];
  const empty = items.every((i) => i.value === 0);
  return (
    <Frame className={className} aria-busy={loading || undefined}>
      <FrameHeader
        title="Assistente de IA"
        description={`${drafts.generated.toLocaleString("pt-BR")} rascunhos gerados no período.`}
        actions={
          drafts.awaitingReview > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-bg-white-0 px-2 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
              <RiDraftLine className="size-3.5" aria-hidden="true" />
              {drafts.awaitingReview.toLocaleString("pt-BR")} aguardando revisão
            </span>
          ) : undefined
        }
      />
      <FramePanel className={cn("grid gap-4 transition-opacity lg:grid-cols-2 lg:gap-8", loading && "opacity-60")}>
        <div className="grid grid-cols-3 gap-px self-start bg-stroke-soft-200">
          <AiStat label="Rascunhos enviados" value={formatCompact(kpis.draftsSent.value)} metric={kpis.draftsSent} note="Rascunhos da IA que foram enviados" />
          <AiStat label="Classificados" value={formatCompact(kpis.classified.value)} metric={kpis.classified} note="Respostas rotuladas pela IA" />
          <AiStat label="Taxa de ajuste" value={formatPercent(kpis.overrideRate.value)} metric={kpis.overrideRate} upIsGood={false} note="Rótulos alterados por uma pessoa" />
        </div>
        <div className="border-t border-stroke-soft-200 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          {empty ? (
            <EmptyChart height={120} title="Nenhum rascunho resolvido" description="Nada foi enviado ou descartado no período." />
          ) : (
            <div>
              {sent > 0 && (
                <p className="mb-4 flex items-center gap-2 text-paragraph-sm text-text-strong-950">
                  <RiCheckDoubleLine className="size-4 shrink-0 text-text-sub-600" aria-hidden="true" />
                    <span>
                      <span className="text-label-sm">{formatPercent(drafts.sentAsIs / sent)}</span> dos rascunhos enviados saíram sem edição
                      <span className="text-text-sub-600"> ({drafts.sentAsIs.toLocaleString("pt-BR")} de {sent.toLocaleString("pt-BR")})</span>
                    </span>
                </p>
              )}
              <SegmentedBar items={items} />
            </div>
          )}
        </div>
      </FramePanel>
    </Frame>
  );
}
