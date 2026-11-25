"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  RiBarChart2Line,
  RiHourglassLine,
  RiListOrdered2,
  RiLoader4Line,
  RiPauseCircleLine,
  RiPencilLine,
  RiPlayCircleLine,
  RiLoopRightLine,
  RiTeamLine,
  RiTimeLine,
  RiUserVoiceLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { useDialogs } from "@/components/DialogProvider";
import { LinkedInAccountAvatars } from "@/components/linkedin/LinkedInAccountTag";
import { LinkedInSequenceEditor } from "@/components/linkedin/LinkedInSequenceEditor";
import { CampaignLeadsTab, type InitialLeadsPage } from "@/components/linkedin/campaigns/CampaignLeadsTab";
import { CampaignOverview, type ChartDay } from "@/components/linkedin/campaigns/CampaignOverview";
import { EditCampaignModal } from "@/components/linkedin/campaigns/EditCampaignModal";
import { CAMPAIGN_STATUS, campaignFunnel } from "@/components/linkedin/campaigns/metrics";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { StatRow } from "@/components/page/StatRow";
import { cn } from "@/utils/cn";

export type { CampaignLead } from "@/components/linkedin/campaigns/CampaignLeadsTab";

type LinkedInAccount = { id: string; username: string; name: string | null; profilePictureUrl: string | null };

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "PAUSED";
  type: "REGULAR" | "PERSONAL";
  invitationMessage: string | null;
  acceptanceMessage: string | null;
  followUp1Message: string | null;
  followUp2Message: string | null;
  followUp3Message: string | null;
  accounts: LinkedInAccount[];
  totalLeads: number;
  statusCounts: Record<string, number>;
  createdAt: string;
};

function createdLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" });
}

type TabId = "overview" | "leads" | "sequence";

function sequenceStepsBuilt(campaign: Pick<Campaign, "invitationMessage" | "acceptanceMessage" | "followUp1Message" | "followUp2Message" | "followUp3Message">) {
  return [
    campaign.invitationMessage,
    campaign.acceptanceMessage,
    campaign.followUp1Message,
    campaign.followUp2Message,
    campaign.followUp3Message,
  ].filter(Boolean).length;
}

export function CampaignDetailClient({
  campaign: initial,
  initialLeadsPage,
  accounts,
}: {
  campaign: Campaign;
  initialLeadsPage: InitialLeadsPage;
  accounts: LinkedInAccount[];
}) {
  const router = useRouter();
  const dialogs = useDialogs();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  // The tab lives in the URL (?tab=leads), so a link or a reload lands on it.
  const [tab, setTabState] = useState<TabId>(tabParam === "leads" || tabParam === "sequence" ? tabParam : "overview");
  const setTab = (next: TabId) => {
    setTabState(next);
    const params = new URLSearchParams(searchParams.toString());
    if (next === "overview") params.delete("tab");
    else params.set("tab", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const [campaign, setCampaign] = useState(initial);
  const [showEditCampaign, setShowEditCampaign] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [chartData, setChartData] = useState<ChartDay[] | null>(null);

  useEffect(() => {
    // The server can refresh this prop after an edit; keep the local editable copy in sync.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCampaign(initial);
  }, [initial]);

  useEffect(() => {
    fetch(`/api/linkedin/campaigns/${campaign.id}/chart-data`)
      .then((r) => r.json())
      .then((d) => setChartData(d.ok ? d.data : []))
      .catch(() => setChartData([]));
  }, [campaign.id]);

  const funnel = useMemo(() => campaignFunnel(campaign.statusCounts, campaign.totalLeads), [campaign.statusCounts, campaign.totalLeads]);
  const senderOptions = campaign.accounts.length > 0 ? campaign.accounts : accounts;
  const status = CAMPAIGN_STATUS[campaign.status];
  const steps = sequenceStepsBuilt(campaign);

  async function toggleStatus() {
    const next = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    setToggling(true);
    try {
      const res = await fetch(`/api/linkedin/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) throw new Error(data.error ?? "Algo deu errado. Tente novamente.");
      setCampaign((prev) => ({ ...prev, status: next }));
      router.refresh();
    } catch (cause) {
      await dialogs.alert({
        title: `Não foi possível ${next === "PAUSED" ? "pausar" : "retomar"} a campanha`,
        description: cause instanceof Error ? cause.message : "Algo deu errado. Tente novamente.",
        variant: "error",
      });
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/linkedin/campaigns", label: "Campanhas do LinkedIn" }}
        title={campaign.name}
        badge={
          <>
            <Badge.Root size="medium" variant="lighter" color={status.color}>
              <Badge.Dot />
              {status.label}
            </Badge.Root>
            {campaign.type === "PERSONAL" && (
              <Badge.Root size="medium" variant="lighter" color="yellow">Pessoal</Badge.Root>
            )}
          </>
        }
        description={<span suppressHydrationWarning>{`Criada em ${createdLabel(campaign.createdAt)} · ${steps} de 5 etapas da sequência escritas${campaign.description ? ` · ${campaign.description}` : ""}`}</span>}
        actions={
          <>
            <span className="mr-1 hidden sm:inline-flex">
              <LinkedInAccountAvatars accounts={campaign.accounts} maxVisible={4} />
            </span>
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => setShowEditCampaign(true)}>
              <Button.Icon as={RiPencilLine} />
              Editar
            </Button.Root>
            <Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void toggleStatus()} disabled={toggling}>
              <Button.Icon
                as={toggling ? RiLoader4Line : campaign.status === "ACTIVE" ? RiPauseCircleLine : RiPlayCircleLine}
                className={cn(toggling && "animate-spin")}
              />
              {campaign.status === "ACTIVE" ? "Pausar" : "Retomar"}
            </Button.Root>
          </>
        }
      />

      <StatRow
        className="mt-5"
        items={[
          { label: "Ainda não convidados", value: funnel.queued.toLocaleString("pt-BR"), icon: RiTimeLine, hint: "Leads aguardando o convite" },
          { label: "Aguardando aceite", value: funnel.awaiting.toLocaleString("pt-BR"), icon: RiHourglassLine, hint: "Convites enviados e ainda não aceitos" },
          { label: "Em sequência", value: funnel.inSequence.toLocaleString("pt-BR"), icon: RiLoopRightLine, hint: "Leads aceitos com mensagens ou acompanhamentos pendentes" },
          { label: "Remetentes", value: campaign.accounts.length.toLocaleString("pt-BR"), icon: RiUserVoiceLine, hint: campaign.accounts.map((a) => a.name ?? a.username).join(", ") || "Nenhuma conta remetente atribuída" },
        ]}
      />

      <PageTabs
        className="mt-6"
        label="Seções da campanha"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Visão geral", icon: RiBarChart2Line },
          { value: "leads", label: "Leads", icon: RiTeamLine, count: campaign.totalLeads },
          { value: "sequence", label: "Sequência", icon: RiListOrdered2, count: steps },
        ]}
      />

      {/* Leads and Sequence stay mounted when hidden, so filters, selection and
          unsaved sequence edits survive a trip to another tab. */}
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <CampaignOverview funnel={funnel} statusCounts={campaign.statusCounts} chartData={chartData} />}
        <div hidden={tab !== "leads"}>
          <CampaignLeadsTab
            campaignId={campaign.id}
            campaignName={campaign.name}
            totalLeads={campaign.totalLeads}
            statusCounts={campaign.statusCounts}
            senderOptions={senderOptions}
            initialLeadsPage={initialLeadsPage}
            onLeadRemoved={(removedStatus) =>
              setCampaign((prev) => ({
                ...prev,
                totalLeads: prev.totalLeads - 1,
                statusCounts: { ...prev.statusCounts, [removedStatus]: Math.max(0, (prev.statusCounts[removedStatus] ?? 1) - 1) },
              }))
            }
            onChanged={() => router.refresh()}
          />
        </div>
        <div hidden={tab !== "sequence"}>
          <LinkedInSequenceEditor
            campaignId={campaign.id}
            initialSequence={campaign}
            onSaved={(sequence) => setCampaign((current) => ({ ...current, ...sequence }))}
          />
        </div>
      </div>

      <EditCampaignModal
        campaign={campaign}
        accounts={accounts}
        open={showEditCampaign}
        onOpenChange={setShowEditCampaign}
        onSaved={(updated) => {
          setCampaign((prev) => ({ ...prev, ...updated }));
          setShowEditCampaign(false);
        }}
      />
    </div>
  );
}
