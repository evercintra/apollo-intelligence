"use client";

import { PageHeader } from "@/components/page/PageHeader";
import { AiCampaignsSection } from "@/components/calling/ai/AiCampaignsSection";

/**
 * The Call campaigns page: AI agent campaigns only. Rep campaigns (a list a
 * rep worked through by hand) were taken out of the product on 2 Nov 2026 —
 * a rep now talks to a lead with "Call now" in an AI campaign's lead drawer.
 * Existing rep campaigns keep their data, and their pages still open from old
 * links (/calling/campaigns/:id); nothing lists or creates them any more.
 */
export default function CampaignsClient() {
  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        title="Campanhas de chamadas"
        description="O agente de IA liga para seus leads pelo WhatsApp, faz follow-up e encaminha as pessoas interessadas para você."
      />
      <AiCampaignsSection />
    </div>
  );
}
