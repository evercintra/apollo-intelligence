import { SettingsPage } from "@/components/settings/SettingsPage";
import InstructionsSettings from "@/components/settings/InstructionsSettings";

export const metadata = { title: "Instruções" };
export const dynamic = "force-dynamic";

export default function InstructionsPage() {
  return (
    <SettingsPage
      title="Instruções"
      description="Orientações adicionadas a cada rascunho e classificação de IA. Cada instrução é enviada à IA como uma seção própria com título."
    >
      <InstructionsSettings />
    </SettingsPage>
  );
}
