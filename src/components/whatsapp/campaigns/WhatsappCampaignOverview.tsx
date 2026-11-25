"use client";

import {
  RiCheckboxCircleLine,
  RiChat1Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiMailSendLine,
  RiReplyLine,
  RiSendPlaneLine,
  RiStopCircleLine,
  RiTeamLine,
  RiTimeLine,
} from "@remixicon/react";
import { BarList, type BarListItem } from "@/components/analytics/kit/BarList";
import { DonutChart, type DonutItem } from "@/components/analytics/kit/DonutChart";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { FunnelChart } from "@/components/analytics/kit/FunnelChart";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { CHANNEL_META, formatCompact, formatPercent, HUE, MUTED, STATUS } from "@/components/analytics/theme";
import type { WhatsappCampaignDetail } from "@/lib/whatsapp/campaigns/contract";
import type { CampaignFunnel } from "./metrics";

/**
 * A message campaign's Overview: headline numbers, the leads -> messaged ->
 * replied funnel, where every lead stands now (a donut: the states are
 * exclusive and sum to the leads) and how many messages each step has sent.
 * Messages wear the WhatsApp channel green, as on Analytics.
 */
const WHATSAPP = CHANNEL_META.whatsapp.color;

function pct(part: number, whole: number): string | undefined {
  return whole > 0 ? formatPercent(part / whole) : undefined;
}

export function WhatsappCampaignOverview({ funnel: f, campaign }: { funnel: CampaignFunnel; campaign: WhatsappCampaignDetail }) {
  const leadStates: DonutItem[] = [
    { key: "queued", label: "Na fila", value: f.queued, color: MUTED, icon: RiTimeLine },
    { key: "in_sequence", label: "Em sequência", value: f.inSequence, color: HUE.amber, icon: RiLoader4Line },
    { key: "completed", label: "Concluído sem resposta", value: f.completed, color: HUE.teal, icon: RiCheckboxCircleLine },
    { key: "replied", label: "Respondeu", value: f.replied, color: WHATSAPP, icon: RiReplyLine },
    { key: "stopped", label: "Interrompido", value: f.stopped, color: HUE.orange, icon: RiStopCircleLine },
    { key: "failed", label: "Falhou", value: f.failed, color: STATUS.critical, icon: RiErrorWarningLine },
  ];

  const perStep: BarListItem[] = campaign.steps.map((step, i) => ({
    key: step.id,
    label: i === 0 ? "Primeira mensagem" : `Follow-up ${i}`,
    value: campaign.sentByStep[step.id] ?? 0,
    color: WHATSAPP,
  }));
  const anySent = perStep.some((item) => item.value > 0);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:gap-5">
      <KpiStrip className="lg:col-span-12" columns={5}>
        <KpiCell icon={RiTeamLine} label="Leads" value={formatCompact(f.total)} context={f.queued > 0 ? `${formatCompact(f.queued)} ainda não contatados` : f.total > 0 ? "Todos foram contatados" : undefined} />
        <KpiCell icon={RiSendPlaneLine} label="Contatados" value={formatCompact(f.messaged)} context={pct(f.messaged, f.total) ? `${pct(f.messaged, f.total)} dos leads` : undefined} hint="Leads que receberam pelo menos uma mensagem e estão em sequência, concluídos ou responderam." />
        <KpiCell icon={RiChat1Line} label="Responderam" value={formatCompact(f.replied)} context={f.replyRate !== null ? `${formatPercent(f.replyRate)} dos contatados` : undefined} hint="Leads que responderam em qualquer canal. Uma resposta interrompe a sequência." />
        <KpiCell icon={RiMailSendLine} label="Mensagens enviadas" value={formatCompact(f.messagesSent)} context={`${campaign.stepCount} ${campaign.stepCount === 1 ? "mensagem" : "mensagens"} na sequência`} hint="Todas as mensagens entregues no WhatsApp, primeiras mensagens e follow-ups." />
        <KpiCell icon={RiErrorWarningLine} label="Falhas" value={formatCompact(f.failed)} context={f.stopped > 0 ? `${formatCompact(f.stopped)} interrompidos` : f.failed > 0 ? "O WhatsApp recusou o número ou a mensagem" : "Nenhuma"} hint="Leads para os quais o WhatsApp não conseguiu entregar. A aba Leads mostra o motivo de cada um." />
      </KpiStrip>

      <Frame className="self-start lg:col-span-5">
        <FrameHeader title="Funil" description="Leads, contatados, responderam." />
        <FramePanel>
          <FunnelChart
            stages={[
              { key: "leads", label: "Leads", value: f.total },
              { key: "messaged", label: "Contatados", value: f.messaged },
              { key: "replied", label: "Responderam", value: f.replied },
            ]}
          />
        </FramePanel>
        <FrameFooter>Todos os leads desta campanha, conforme o Progresso. Desde sempre.</FrameFooter>
      </Frame>

      <Frame className="lg:col-span-7">
        <FrameHeader title="Situação dos leads" description="Todos os leads da campanha, conforme sua situação atual." />
        <FramePanel>
          <DonutChart items={leadStates} centerLabel="leads" emptyLabel="Nenhum lead ainda" emptyDescription="Adicione leads para ver a situação de cada um." />
        </FramePanel>
      </Frame>

      <Frame className="lg:col-span-12">
        <FrameHeader title="Mensagens por etapa" description="Quantas vezes cada mensagem da sequência foi enviada." />
        <FramePanel>
          <BarList items={anySent ? perStep : []} emptyLabel="Nenhuma mensagem enviada ainda." />
        </FramePanel>
      </Frame>
    </div>
  );
}
