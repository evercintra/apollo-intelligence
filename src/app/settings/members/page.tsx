import { OrgMembers } from "@/components/settings/organization/OrgMembers";
import { SettingsPage } from "@/components/settings/SettingsPage";

export const metadata = { title: "Membros" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <SettingsPage title="Membros" description="Convide pessoas e gerencie o que cada uma pode fazer." width="narrow">
      <OrgMembers />
    </SettingsPage>
  );
}
