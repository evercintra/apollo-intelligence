import { OrgTeams } from "@/components/settings/organization/OrgTeams";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata = { title: "Equipes" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SettingsPage title="Equipes" description="Agrupe membros em equipes." width="narrow">
      <OrgTeams />
    </SettingsPage>
  );
}
