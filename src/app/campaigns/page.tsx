import CreateCampaignForm from "@/components/campaigns/CreateCampaignForm";
import CampaignListClient from "@/components/campaigns/CampaignListClient";
import { requirePageOrgContext } from "@/lib/auth/context";
import { runInOrganization } from "@/lib/tenancy/scope";
import { listCampaigns } from "@/lib/qualification";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const ctx = await requirePageOrgContext();
  const campaigns = await runInOrganization(ctx.organizationId, () => listCampaigns());

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-weak-50 md:flex-row">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden md:flex-row">
        {/* Create form — left */}
        <aside className="max-h-[50vh] w-full shrink-0 overflow-y-auto border-b border-stroke-soft-200 bg-bg-white-0 md:max-h-none md:w-80 md:border-b-0 md:border-r">
          <div className="px-4 py-4 border-b border-stroke-soft-200">
            <h1 className="text-sm font-bold text-text-strong-950">Nova campanha de qualificação</h1>
            <p className="mt-0.5 text-xs text-text-strong-950/60">
              Defina os filtros, qualifique empresas e gere o link de busca de pessoas na Apollo.
            </p>
          </div>
          <CreateCampaignForm />
        </aside>

        {/* Campaign list — right */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="px-6 py-5 overflow-y-auto">
            <h2 className="text-lg font-bold text-text-strong-950">Campanhas de qualificação</h2>
            <p className="mb-4 mt-0.5 text-xs text-text-strong-950/60">
              Crie, acompanhe e gerencie campanhas de qualificação de empresas.
            </p>
            <CampaignListClient campaigns={campaigns} />
          </div>
        </div>
      </div>
    </div>
  );
}
