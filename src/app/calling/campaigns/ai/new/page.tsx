import { requirePageOrgContext } from "@/lib/auth/context";
import { AiCampaignWizard } from "@/components/calling/ai/AiCampaignWizard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Nova campanha de chamadas com IA" };

export default async function NewAiCallCampaignPage() {
  await requirePageOrgContext();
  return <AiCampaignWizard />;
}
