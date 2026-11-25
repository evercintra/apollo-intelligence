"use client";

import {
  RiAlarmWarningLine,
  RiArchiveLine,
  RiCheckboxCircleLine,
  RiDraftLine,
  RiInboxLine,
  RiLinkedinBoxLine,
  RiMailForbidLine,
  RiSearchLine,
  RiWhatsappLine,
} from "@remixicon/react";
import type { ActionSignalKey } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { Frame, FrameHeader, FramePanel } from "../kit/Frame";
import { KpiCell, KpiStrip } from "../kit/KpiStrip";
import { ProgressList, type ProgressTone } from "../kit/ProgressList";
import { RankedList, type RankedItem } from "../kit/RankedList";
import { formatCompact, formatDateTime } from "../theme";
import type { ViewProps } from "./types";

type SignalMeta = { label: string; hint: string; href: string; tone: ProgressTone; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> };

const SIGNALS: Record<ActionSignalKey, SignalMeta> = {
  actionRequired: { label: "Ações necessárias", hint: "Conversas aguardando uma resposta ou decisão", href: "/crm/actions", tone: "serious", icon: RiInboxLine },
  followUpsDue: { label: "Follow-ups vencidos", hint: "Follow-ups em rascunho ou passando do horário", href: "/crm/actions", tone: "critical", icon: RiAlarmWarningLine },
  draftsAwaitingReview: { label: "Rascunhos para revisar", hint: "Respostas da IA aguardando aprovação", href: "/crm/actions", tone: "warning", icon: RiDraftLine },
  failingMailboxes: { label: "Caixas com falha", hint: "Contas de e-mail que não conseguem enviar", href: "/settings/email-accounts", tone: "critical", icon: RiMailForbidLine },
  linkedinDisconnected: { label: "LinkedIn desconectado", hint: "Contas que precisam ser reconectadas", href: "/settings/linkedin-accounts", tone: "critical", icon: RiLinkedinBoxLine },
  whatsappDisconnected: { label: "WhatsApp desconectado", hint: "Números que precisam ser religados", href: "/settings/whatsapp-accounts", tone: "critical", icon: RiWhatsappLine },
  failedEmailSends: { label: "Envios de e-mail falhos", hint: "Falhas de envio no período", href: "/analytics?view=email", tone: "warning", icon: RiMailForbidLine },
  failedQualificationJobs: { label: "Jobs de qualificação falhos", hint: "Execuções de qualificação que terminaram com erro", href: "/campaigns", tone: "critical", icon: RiSearchLine },
  parentPending: { label: "Domínios pai pendentes", hint: "Domínios aguardando uma rodada anterior", href: "/campaigns", tone: "neutral", icon: RiArchiveLine },
};

export function ActionsView({ data, loading }: ViewProps<"actions">) {
  const dim = cn(loading && "opacity-60");
  const signals = new Map(data.signals.map((signal) => [signal.key, signal.value]));
  const total = data.signals.reduce((sum, signal) => sum + signal.value, 0);
  const failedSends = signals.get("failedEmailSends") ?? 0;

  const issues: RankedItem[] = data.campaignsWithIssues.map((campaign) => ({
    key: campaign.id,
    label: campaign.name,
    sublabel: `Status: ${campaign.status.toLowerCase()}`,
    value: `${formatCompact(campaign.failedJobs)} falhas`,
    subvalue: formatDateTime(campaign.lastFailedAt),
    icon: RiSearchLine,
    href: `/campaigns/${campaign.id}`,
  }));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={3}>
        <KpiCell icon={RiAlarmWarningLine} label="Itens que pedem ação" value={formatCompact(total)} context="soma dos sinais abaixo" hint="Total de ocorrências abertas ou falhas detectadas." />
        <KpiCell icon={RiSearchLine} label="Campanhas com falhas" value={formatCompact(data.campaignsWithIssues.length)} context="qualificação" hint="Campanhas com ao menos um job de qualificação falho." />
        <KpiCell icon={RiInboxLine} label="Envios falhos" value={formatCompact(failedSends)} context="no período" hint="E-mails com status de falha no período selecionado." />
      </KpiStrip>

      <Frame className="lg:col-span-7">
        <FrameHeader title="Sinais que pedem ação" description="O que está bloqueando a operação agora." />
        <FramePanel className={dim}>
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <RiCheckboxCircleLine className="size-7 text-success-base" aria-hidden="true" />
              <p className="mt-3 text-label-sm text-text-strong-950">Tudo em dia</p>
              <p className="mt-1 text-paragraph-xs text-text-sub-600">Nenhum sinal pendente ou falho foi detectado.</p>
            </div>
          ) : (
            <ProgressList
              items={data.signals.map((signal) => {
                const meta = SIGNALS[signal.key];
                return {
                  key: signal.key,
                  label: meta.label,
                  value: signal.value,
                  subline: meta.hint,
                  tone: signal.value > 0 ? meta.tone : "neutral",
                  icon: signal.value > 0 ? meta.icon : undefined,
                  href: meta.href,
                };
              })}
            />
          )}
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-5">
        <FrameHeader title="Campanhas com falhas" description="Onde a qualificação parou ou apresentou erro." />
        <FramePanel className={dim}>
          <RankedList items={issues} emptyLabel="Nenhuma campanha com falha." />
        </FramePanel>
      </Frame>
    </div>
  );
}
