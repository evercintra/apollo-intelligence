"use client";

import { RiBuilding2Line, RiGlobalLine, RiGroupLine, RiSearchLine } from "@remixicon/react";
import * as Table from "@/components/alignui/table";
import type { AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { Frame, FrameFooterLink, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { RankedList, type RankedItem } from "../kit/RankedList";
import { CHANNEL_META, formatCompact, formatDateTime, formatPercent } from "../theme";
import type { ViewProps } from "./types";

const STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  ready: "Pronta",
  building: "Em montagem",
  running: "Em execução",
  paused: "Pausada",
  draft: "Rascunho",
  completed: "Concluída",
  done: "Concluída",
  qualified: "Qualificada",
  pending: "Pendente",
};

const statusLabel = (status: string) => STATUS_LABEL[status.toLowerCase()] ?? status;

export function ProspectingView({ data, loading, onSelectView }: ViewProps<"prospecting">) {
  const { commercial } = data;
  const dim = cn(loading && "opacity-60");

  const qualified: RankedItem[] = data.recentQualified.map((row) => ({
    key: row.domain,
    label: row.domain,
    sublabel: [row.campaignName, row.countryCode].filter(Boolean).join(" · ") || "Domínio qualificado",
    value: row.revenue === null ? "—" : `US$ ${formatCompact(row.revenue)}`,
    subvalue: formatDateTime(row.checkedAt),
    icon: RiGlobalLine,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={4}>
        <KpiCell icon={RiBuilding2Line} label="Empresas encontradas" value={formatCompact(commercial.companies.new.value)} metric={commercial.companies.new} context={`${formatCompact(commercial.companies.total)} no total`} hint="Empresas criadas no período." />
        <KpiCell icon={RiGroupLine} label="Pessoas encontradas" value={formatCompact(commercial.people.new.value)} metric={commercial.people.new} context={`${formatCompact(commercial.people.total)} no total`} hint="Pessoas criadas no período." />
        <KpiCell icon={RiSearchLine} label="Domínios qualificados" value={formatCompact(commercial.qualifiedDomains.inRange.value)} metric={commercial.qualifiedDomains.inRange} context={`${formatCompact(commercial.qualifiedDomains.total)} no total`} hint="Domínios que passaram na qualificação no período." />
        <KpiCell icon={RiSearchLine} label="Campanhas ativas" value={formatCompact(data.activeCampaigns)} context={`${data.campaignCounts.reduce((sum, row) => sum + row.total, 0)} campanhas no total`} hint="Campanhas ativas de e-mail, LinkedIn e WhatsApp somadas." />
      </KpiStrip>

      <Frame className="lg:col-span-8">
        <FrameHeader title="Campanhas de qualificação" description="Execuções que transformam domínios em oportunidades." />
        <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", dim)}>
          <Table.Root>
            <Table.Caption className="sr-only">Campanhas de qualificação</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">Campanha</Table.Head>
                <Table.Head scope="col">Status</Table.Head>
                <Table.Head scope="col" className="text-right">Alvos</Table.Head>
                <Table.Head scope="col" className="text-right">Analisados</Table.Head>
                <Table.Head scope="col" className="text-right">Qualificados</Table.Head>
                <Table.Head scope="col" className="text-right">Taxa</Table.Head>
                <Table.Head scope="col">Última checagem</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {data.qualificationCampaigns.map((campaign) => (
                <Table.Row key={campaign.id}>
                  <Table.Cell className="h-12">
                    <p className="truncate text-label-sm text-text-strong-950">{campaign.name}</p>
                    <p className="truncate text-paragraph-xs text-text-sub-600">{campaign.targetLeadCount} leads · {campaign.targetDomainCount === null ? "domínios ilimitados" : `${campaign.targetDomainCount} domínios`}</p>
                  </Table.Cell>
                  <Table.Cell className="h-12 text-paragraph-sm text-text-sub-600">{statusLabel(campaign.status)}</Table.Cell>
                  <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.targetDomainCount ?? campaign.targetLeadCount)}</Table.Cell>
                  <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.analyzed)}</Table.Cell>
                  <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatCompact(campaign.qualified)}</Table.Cell>
                  <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{formatPercent(campaign.qualifiedRate)}</Table.Cell>
                  <Table.Cell className="h-12 text-paragraph-sm text-text-sub-600">{formatDateTime(campaign.lastCheckedAt)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-4">
        <FrameHeader title="Da prospecção ao CRM" description="Resultado comercial acumulado." />
        <FramePanel className={dim}>
          <RankedList
            items={[
              { key: "opportunities", label: "Oportunidades abertas", value: formatCompact(commercial.opportunities), icon: RiBuilding2Line },
              { key: "customers", label: "Clientes", value: formatCompact(commercial.customers), icon: RiBuilding2Line },
              { key: "notInterested", label: "Não interessados", value: formatCompact(commercial.notInterested), icon: RiBuilding2Line },
            ]}
            emptyLabel="Nenhum resultado comercial ainda."
          />
        </FramePanel>
        <FrameFooterLink href="/crm/pipeline">Ver pipeline comercial</FrameFooterLink>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Campanhas por canal" description="Selecione um canal para ver a análise detalhada." />
        <FramePanel className={cn("overflow-x-auto p-2 transition-opacity sm:p-3", dim)}>
          <Table.Root>
            <Table.Caption className="sr-only">Campanhas por canal</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col">Canal</Table.Head>
                <Table.Head scope="col" className="text-right">Ativas</Table.Head>
                <Table.Head scope="col" className="text-right">Pausadas</Table.Head>
                <Table.Head scope="col" className="text-right">Rascunhos</Table.Head>
                <Table.Head scope="col" className="text-right">Concluídas</Table.Head>
                <Table.Head scope="col" className="text-right">Total</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {data.campaignCounts.map((row) => {
                const meta = CHANNEL_META[row.channel];
                const Icon = meta.icon;
                return (
                  <Table.Row key={row.channel} className="cursor-pointer" onClick={() => onSelectView?.(row.channel as AnalyticsView)}>
                    <Table.Cell className="h-12">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onSelectView?.(row.channel as AnalyticsView); }} className="flex items-center gap-2.5 rounded-md text-label-sm text-text-strong-950 outline-none focus-visible:ring-2 focus-visible:ring-primary-base">
                        <span className="flex size-6 items-center justify-center rounded-md" style={{ backgroundColor: meta.color }}>
                          <Icon className="size-4 text-white" />
                        </span>
                        {meta.label}
                      </button>
                    </Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{row.active}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{row.paused}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{row.draft}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{row.completed}</Table.Cell>
                    <Table.Cell className="h-12 text-right text-paragraph-sm tabular-nums text-text-strong-950">{row.total}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-6">
        <FrameHeader title="Qualificações recentes" description="Últimos domínios aprovados pelas campanhas." />
        <FramePanel className={dim}>
          <RankedList items={qualified} emptyLabel="Nenhuma qualificação recente." />
        </FramePanel>
      </Frame>
    </div>
  );
}
