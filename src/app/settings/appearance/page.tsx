import AppearanceSettings from "@/components/settings/AppearanceSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata = { title: "Aparência" };

export default function AppearancePage() {
  return (
    <SettingsPage title="Aparência" description="Claro, escuro ou igual ao sistema." width="narrow">
      <AppearanceSettings />
    </SettingsPage>
  );
}
