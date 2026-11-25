"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RiAddLine, RiRobot2Line } from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Table from "@/components/alignui/table";
import { ErrorState } from "@/components/analytics/kit/ErrorState";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { EmptyState } from "@/components/page/EmptyState";
import { Skeleton } from "@/components/page/Skeletons";
import { useRefreshOnReturn } from "@/components/calling/useRefreshOnReturn";
import type { AiCampaignSummary } from "@/lib/calls/aiCampaigns/api";
import { listAiCampaigns } from "@/lib/calls/aiCampaigns/client";
import { cn } from "@/utils/cn";
import { AI_GOAL_TEXT_PT, AiAgentBadge, AiCampaignStateBadge, errorText } from "./aiShared";

export const NEW_AI_CAMPAIGN_HREF = "/calling/campaigns/ai/new";
const num = "text-paragraph-sm tabular-nums text-text-strong-950";

/** The AI agent campaigns: the Call campaigns page's list. */
export function AiCampaignsSection() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<AiCampaignSummary[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setCampaigns((await listAiCampaigns()).campaigns);
      setError("");
    } catch (cause) {
      setError(errorText(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useRefreshOnReturn(load);

  const open = (id: string) => router.push(`/calling/campaigns/ai/${id}`);

  return (
    <Frame className="mt-5">
      <FrameHeader
        title="Campanhas com agente de IA"
        description="O agente liga para os leads a partir dos seus números, faz follow-up pelo WhatsApp e encaminha as pessoas interessadas."
        actions={
          <Button.Root variant="primary" mode="filled" size="small" onClick={() => router.push(NEW_AI_CAMPAIGN_HREF)}>
            <Button.Icon as={RiAddLine} />
            Nova campanha com IA
          </Button.Root>
        }
      />
      <FramePanel className="overflow-x-auto p-2 sm:p-2">
        {error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : campaigns === null ? (
          <div aria-busy="true" aria-label="Carregando" className="space-y-2 p-2">
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ) : campaigns.length === 0 ? (
          <EmptyState
            compact
            icon={RiRobot2Line}
            title="Nenhuma campanha com IA ainda"
            description="Defina um objetivo, escolha números para ligações e adicione leads. O agente segue sua sequência de ligações e mensagens pelo WhatsApp."
            action={
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => router.push(NEW_AI_CAMPAIGN_HREF)}>
                <Button.Icon as={RiAddLine} />
                Nova campanha com IA
              </Button.Root>
            }
          />
        ) : (
          <Table.Root className="min-w-[860px]">
            <Table.Header>
              <Table.Row>
                <Table.Head scope="col" className="px-4">Campanha</Table.Head>
                <Table.Head scope="col" className="w-48 px-4">Números</Table.Head>
                <Table.Head scope="col" className="w-24 px-4 text-right">Leads</Table.Head>
                <Table.Head scope="col" className="w-28 px-4 text-right">Ligações hoje</Table.Head>
                <Table.Head scope="col" className="w-24 px-4 text-right">Agendadas</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body spacing={4}>
              {campaigns.map((campaign) => (
                <Table.Row
                  key={campaign.id}
                  tabIndex={0}
                  onClick={() => open(campaign.id)}
                  onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") open(campaign.id); }}
                  className="cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50"
                >
                  <Table.Cell className="h-16 px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-label-sm text-text-strong-950" title={campaign.name}>{campaign.name}</span>
                      <AiAgentBadge />
                      <AiCampaignStateBadge state={campaign.state} size="small" />
                    </div>
                    <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600">{AI_GOAL_TEXT_PT[campaign.goal].label} · {campaign.stepCount} {campaign.stepCount === 1 ? "etapa" : "etapas"}</p>
                  </Table.Cell>
                  <Table.Cell className="px-4 text-paragraph-sm text-text-sub-600">
                    <span className="block truncate" title={campaign.numbers.map((n) => n.name).join(", ")}>
                      {campaign.numbers.length === 0 ? "Nenhum ainda" : campaign.numbers.map((n) => n.name).join(", ")}
                    </span>
                  </Table.Cell>
                  <Table.Cell className={cn("px-4 text-right", num)}>{campaign.leads.toLocaleString("pt-BR")}</Table.Cell>
                  <Table.Cell className={cn("px-4 text-right", num)}>{campaign.callsToday.toLocaleString("pt-BR")}</Table.Cell>
                  <Table.Cell className={cn("px-4 text-right", num)}>{campaign.booked.toLocaleString("pt-BR")}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}
      </FramePanel>
    </Frame>
  );
}
