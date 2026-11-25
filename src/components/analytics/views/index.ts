import type { ComponentType } from "react";
import type { AnalyticsView } from "@/lib/analytics/contract";
import { ActionsView } from "./ActionsView";
import { EmailView } from "./EmailView";
import { LinkedinView } from "./LinkedinView";
import { MarketView } from "./MarketView";
import { OverviewView } from "./OverviewView";
import { PipelineView } from "./PipelineView";
import { ProspectingView } from "./ProspectingView";
import { WhatsappView } from "./WhatsappView";
import type { ViewProps } from "./types";

/**
 * The view registry. One entry per view. Each component receives
 * `{ data, loading, onSelectView? }` typed to its own response.
 */
export const views: { [V in AnalyticsView]: ComponentType<ViewProps<V>> } = {
  overview: OverviewView,
  market: MarketView,
  prospecting: ProspectingView,
  pipeline: PipelineView,
  actions: ActionsView,
  email: EmailView,
  linkedin: LinkedinView,
  whatsapp: WhatsappView,
};

export type { ViewProps } from "./types";
