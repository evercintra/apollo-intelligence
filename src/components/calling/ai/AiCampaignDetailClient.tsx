"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  RiArchiveLine,
  RiBarChart2Line,
  RiCalendarCheckLine,
  RiErrorWarningLine,
  RiListOrdered2,
  RiLoader4Line,
  RiMoreLine,
  RiPauseCircleLine,
  RiPhoneLine,
  RiPlayCircleLine,
  RiRocketLine,
  RiSettings3Line,
  RiSmartphoneLine,
  RiSpeakLine,
  RiTeamLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { Skeleton } from "@/components/page/Skeletons";
import { StatRow } from "@/components/page/StatRow";
import type { AiCampaignDetail, AiCampaignStats } from "@/lib/calls/aiCampaigns/api";
import { archiveAiCampaign, getAiCampaign, getAiCampaignStats, launchAiCampaign, updateAiCampaign } from "@/lib/calls/aiCampaigns/client";
import { cn } from "@/utils/cn";
import { AiAgentBadge, AiCampaignStateBadge, aiErrorPt, errorText } from "./aiShared";
import { AiCampaignOverview } from "./AiCampaignOverview";
import { AiLeadsTab } from "./AiLeadsTab";
import { AiSequenceTab } from "./AiSequenceTab";
import { AiSettingsTab } from "./AiSettingsTab";
import { VoiceCompareTab } from "./VoiceCompareTab";
import type { AiCampaignTab } from "./tabs";

const REFRESH_MS = 30_000;
const LIST = { href: "/calling/campaigns", label: "Campanhas de chamadas" };

export function AiCampaignDetailClient({ campaignId, initialTab }: { campaignId: string; initialTab: AiCampaignTab }) {
  const router = useRouter();
  const pathname = usePathname();
  const dialogs = useDialogs();
  const [tab, setTabState] = useState<AiCampaignTab>(initialTab);
  const [campaign, setCampaign] = useState<AiCampaignDetail | null>(null);
  const [stats, setStats] = useState<AiCampaignStats | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setTab = (next: AiCampaignTab) => {
    setTabState(next);
    router.replace(next === "overview" ? pathname : `${pathname}?tab=${next}`, { scroll: false });
  };

  const load = useCallback(async () => {
    try {
      const [detail, nextStats] = await Promise.all([getAiCampaign(campaignId), getAiCampaignStats(campaignId).catch(() => null)]);
      setCampaign(detail);
      if (nextStats) setStats(nextStats);
      setLoadError(null);
    } catch (cause) {
      setLoadError(errorText(cause, "Não foi possível carregar a campanha"));
    }
  }, [campaignId]);

  useEffect(() => {
    // Fetch on mount; state is set after the response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // A running campaign moves on its own; keep the figures fresh while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => { if (document.visibilityState === "visible") void load(); }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function launch() {
    if (!campaign) return;
    setBusy(true);
    try {
      setCampaign(await launchAiCampaign(campaign.id));
      void load();
    } catch (cause) {
      await dialogs.alert({ title: "Não foi possível lançar a campanha", description: errorText(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function toggle() {
    if (!campaign) return;
    setBusy(true);
    try {
      setCampaign(await updateAiCampaign(campaign.id, { status: campaign.state === "active" ? "paused" : "active" }));
      void load();
    } catch (cause) {
      await dialogs.alert({ title: campaign.state === "active" ? "Não foi possível pausar a campanha" : "Não foi possível retomar a campanha", description: errorText(cause), variant: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function archive() {
    if (!campaign) return;
    const ok = await dialogs.confirm({
      title: "Arquivar campanha?",
      description: "As ligações e mensagens param e a campanha sai da lista. As ligações já feitas permanecem em cada lead, com gravações e transcrições.",
      confirmLabel: "Arquivar campanha",
      variant: "error",
    });
    if (!ok) return;
    try {
      await archiveAiCampaign(campaign.id);
      router.push(LIST.href);
    } catch (cause) {
      await dialogs.alert({ title: "Não foi possível arquivar a campanha", description: errorText(cause), variant: "error" });
    }
  }

  if (!campaign) {
    if (loadError) {
      return (
        <div className="mx-auto w-full max-w-[1440px]">
          <PageHeader back={LIST} title="Campanha de chamadas com IA" />
          <EmptyState icon={RiErrorWarningLine} title="Não foi possível carregar a campanha" description={loadError} action={<Button.Root variant="neutral" mode="stroke" size="small" onClick={() => void load()}>Tentar novamente</Button.Root>} />
        </div>
      );
    }
    return (
      <div aria-busy="true" aria-label="Carregando" className="mx-auto w-full max-w-[1440px] space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const draft = campaign.state === "draft";
  const canLaunch = draft && !campaign.blocker;
  const numberNames = campaign.numbers.map((number) => number.name).join(", ");

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={LIST}
        title={campaign.name}
        badge={
          <>
            <AiCampaignStateBadge state={campaign.state} />
            <AiAgentBadge />
          </>
        }
        description={<span suppressHydrationWarning>{`Criada em ${new Date(campaign.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" })} · ${campaign.stepCount} ${campaign.stepCount === 1 ? "etapa" : "etapas"} na sequência${campaign.description ? ` · ${campaign.description}` : ""}`}</span>}
        actions={
          <>
            {draft ? (
                <Button.Root variant="primary" mode="filled" size="small" onClick={() => void launch()} disabled={busy || !canLaunch} title={campaign.blocker ? aiErrorPt(campaign.blocker) : undefined}>
                <Button.Icon as={busy ? RiLoader4Line : RiRocketLine} className={cn(busy && "animate-spin")} />
                Lançar
              </Button.Root>
            ) : (
              <Button.Root variant={campaign.state === "paused" ? "primary" : "neutral"} mode={campaign.state === "paused" ? "filled" : "stroke"} size="small" onClick={() => void toggle()} disabled={busy}>
                <Button.Icon as={busy ? RiLoader4Line : campaign.state === "active" ? RiPauseCircleLine : RiPlayCircleLine} className={cn(busy && "animate-spin")} />
                {campaign.state === "active" ? "Pausar" : "Retomar"}
              </Button.Root>
            )}
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <Button.Root variant="neutral" mode="stroke" size="small" aria-label="Mais ações"><Button.Icon as={RiMoreLine} /></Button.Root>
              </Dropdown.Trigger>
              <Dropdown.Content align="end">
                <Dropdown.Item destructive onSelect={() => void archive()}>
                  <Dropdown.ItemIcon as={RiArchiveLine} />
                  Arquivar campanha
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          </>
        }
      />
      {draft && campaign.blocker && <p className="mt-3 text-paragraph-xs text-text-sub-600">Não é possível lançar ainda: {aiErrorPt(campaign.blocker).charAt(0).toLowerCase()}{aiErrorPt(campaign.blocker).slice(1)}.</p>}
      {draft && !campaign.blocker && <p className="mt-3 text-paragraph-xs text-text-sub-600">Esta campanha é um rascunho e não faz ligações até você lançá-la.</p>}

      <StatRow
        className="mt-5"
        items={[
          { label: "Leads", value: campaign.leads.toLocaleString("pt-BR"), icon: RiTeamLine, hint: "Pessoas inscritas nesta campanha" },
          { label: "Ligações hoje", value: `${campaign.callsToday.toLocaleString("pt-BR")}${campaign.callsPerDayLimit ? ` / ${campaign.callsPerDayLimit.toLocaleString("pt-BR")}` : ""}`, icon: RiPhoneLine, hint: "Ligações feitas hoje, dentro do limite diário dos números da campanha" },
          { label: "Agendadas", value: campaign.booked.toLocaleString("pt-BR"), icon: RiCalendarCheckLine, hint: "Reuniões agendadas pelos leads desta campanha" },
          { label: "Números", value: campaign.numbers.length.toLocaleString("pt-BR"), icon: RiSmartphoneLine, hint: numberNames || "Nenhum número de ligação atribuído" },
        ]}
      />

      <PageTabs
        className="mt-6"
        label="Seções da campanha"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "overview", label: "Visão geral", icon: RiBarChart2Line },
          { value: "leads", label: "Leads", icon: RiTeamLine, count: campaign.leads },
          { value: "sequence", label: "Sequência", icon: RiListOrdered2, count: campaign.stepCount },
          { value: "compare", label: "Comparar vozes", icon: RiSpeakLine },
          { value: "settings", label: "Configurações", icon: RiSettings3Line },
        ]}
      />

      {/* Leads, Sequence and Settings stay mounted when hidden, so filters and unsaved edits survive a trip to another tab. */}
      <div role="tabpanel" className="mt-6">
        {tab === "overview" && <AiCampaignOverview campaign={campaign} stats={stats} />}
        <div hidden={tab !== "leads"}>
          <AiLeadsTab campaignId={campaign.id} counts={stats?.byStatus ?? null} total={campaign.leads} onChanged={() => void load()} />
        </div>
        <div hidden={tab !== "sequence"}>
          <AiSequenceTab campaign={campaign} stats={stats?.perStep} onSaved={() => void load()} />
        </div>
        {tab === "compare" && <VoiceCompareTab campaign={campaign} />}
        <div hidden={tab !== "settings"}>
          <AiSettingsTab campaign={campaign} onSaved={() => void load()} onToggle={() => void toggle()} onArchive={() => void archive()} toggling={busy} />
        </div>
      </div>
    </div>
  );
}
