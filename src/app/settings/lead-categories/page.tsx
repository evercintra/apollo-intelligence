import { SettingsPage } from "@/components/settings/SettingsPage";
import CrmSettingsClient from "@/components/crm/CrmSettingsClient";

export const metadata = { title: "Categorias de leads" };
export const dynamic = "force-dynamic";

export default function LeadCategoriesPage() {
  return (
    <SettingsPage
      title="Categorias de leads"
      description="As subcategorias nas quais a IA classifica as respostas e a sequência de respostas que cada uma inicia."
    >
      <CrmSettingsClient />
    </SettingsPage>
  );
}
