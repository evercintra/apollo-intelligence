"use client";

import { RiBuilding2Line, RiCheckboxCircleLine, RiGlobalLine, RiMoneyDollarCircleLine, RiStackLine } from "@remixicon/react";
import type { BreakdownRow } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { BarList, type BarListItem } from "../kit/BarList";
import { DonutChart, type DonutItem } from "../kit/DonutChart";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { ACCENT, formatCompact, formatPercent, ordinalRamp } from "../theme";
import type { ViewProps } from "./types";

const COLORS = ordinalRamp(6);
const COLOR_EXTRA = ["#6F8F5B", "#B7791F", "#B05A8A"] as const;

function donutItems(rows: BreakdownRow[], colors: readonly string[] = COLORS): DonutItem[] {
  return rows.map((row, i) => ({ ...row, color: colors[i % colors.length] ?? ACCENT }));
}

function barItems(rows: BreakdownRow[], colors: readonly string[] = COLORS): BarListItem[] {
  return rows.slice(0, 8).map((row, i) => ({ ...row, color: colors[i % colors.length] ?? ACCENT }));
}

export function MarketView({ data, loading }: ViewProps<"market">) {
  const { kpis, universe } = data;
  const dim = cn(loading && "opacity-60");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={6}>
        <KpiCell icon={RiBuilding2Line} label="Domínios analisados" value={formatCompact(kpis.analyzedDomains.inRange.value)} metric={kpis.analyzedDomains.inRange} context={`${formatCompact(kpis.analyzedDomains.total)} no total`} hint="Domínios verificados pelas campanhas de qualificação no período." />
        <KpiCell icon={RiCheckboxCircleLine} label="Domínios qualificados" value={formatCompact(kpis.qualifiedDomains.inRange.value)} metric={kpis.qualifiedDomains.inRange} context={`${formatCompact(kpis.qualifiedDomains.total)} no total`} hint="Domínios com status qualificado no período." />
        <KpiCell icon={RiCheckboxCircleLine} label="Taxa de qualificação" value={formatPercent(kpis.qualificationRate.value)} metric={kpis.qualificationRate} context="Qualificados ÷ analisados no período" hint="Proporção de domínios analisados que foram qualificados." />
        <KpiCell icon={RiGlobalLine} label="Países" value={formatCompact(kpis.countries)} context="na base qualificada" hint="Países distintos entre os domínios analisados." />
        <KpiCell icon={RiStackLine} label="Segmentos" value={formatCompact(kpis.segments)} context="na base qualificada" hint="Segmentos principais (c1) distintos entre os domínios analisados." />
        <KpiCell icon={RiMoneyDollarCircleLine} label="Receita mediana" value={formatCompact(kpis.medianRevenue)} context="receita anual estimada (USD)" hint="Mediana da receita anual informada pela Apollo para os domínios analisados." />
      </KpiStrip>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Países" description="Onde estão os domínios analisados." />
        <FramePanel className={dim}>
          <BarList items={barItems(data.byCountry)} emptyLabel="Nenhum país informado." />
        </FramePanel>
        <FrameFooter>Base Apollo de {formatCompact(universe.total)} domínios; a distribuição considera os domínios analisados pela sua organização.</FrameFooter>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Status da qualificação" description="Estado atual dos domínios trabalhados." />
        <FramePanel className={dim}>
          <DonutChart items={donutItems(data.byStatus)} centerLabel="domínios" emptyLabel="Nenhum domínio qualificado" emptyDescription="As campanhas de qualificação ainda não retornaram domínios." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Segmentos" description="Distribuição por setor principal." />
        <FramePanel className={dim}>
          <DonutChart items={donutItems(data.bySegment)} centerLabel="domínios" maxSlices={6} emptyLabel="Sem segmentos" />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Subsegmentos" description="Os setores mais específicos encontrados." />
        <FramePanel className={dim}>
          <BarList items={barItems(data.bySubsegment, COLOR_EXTRA)} emptyLabel="Nenhum subsegmento informado." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Plataformas" description="Tecnologia principal detectada no site." />
        <FramePanel className={dim}>
          <DonutChart items={donutItems(data.byPlatform, COLOR_EXTRA)} centerLabel="domínios" emptyLabel="Nenhuma plataforma detectada" />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Faixa de receita" description="Receita anual estimada pela Apollo." />
        <FramePanel className={dim}>
          <BarList items={data.byRevenue.map((row, i) => ({ ...row, color: COLORS[i % COLORS.length] ?? ACCENT }))} emptyLabel="Nenhuma receita informada." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-12">
        <FrameHeader title="Apps instalados" description="Ferramentas mais presentes nos sites analisados." />
        <FramePanel className={dim}>
          <BarList items={barItems(data.topApps, COLOR_EXTRA)} emptyLabel="Nenhum app detectado." />
        </FramePanel>
      </Frame>
    </div>
  );
}
