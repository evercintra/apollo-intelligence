import { AiAssistantsSettings } from "@/components/settings/AiAssistantsSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { mcpResourceUrl } from "@/lib/mcp/oauth";

export const metadata = { title: "Assistentes de IA" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePageOrgContext();
  return (
    <SettingsPage
      title="Assistentes de IA"
      description="Conecte o Claude para trabalhar sua fila Ação necessária: ler conversas, editar e enviar respostas, alterar etapas."
      width="narrow"
    >
      <AiAssistantsSettings serverUrl={mcpResourceUrl()} />
    </SettingsPage>
  );
}
