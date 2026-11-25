import { ApiKeysSettings } from "@/components/settings/ApiKeysSettings";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { Callout } from "@/components/settings/SettingsKit";
import { can, requirePageOrgContext } from "@/lib/auth/context";
import { listApiKeys } from "@/lib/publicApi/keys";
import { runInOrganization } from "@/lib/tenancy/scope";

export const metadata = { title: "Chaves de API" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const ctx = await requirePageOrgContext();
  const canManage = can(ctx, { integrations: ["manage"] });
  const keys = canManage ? await runInOrganization(ctx.organizationId, listApiKeys) : [];
  return (
    <SettingsPage
      title="Chaves de API"
      description="Permita que outro aplicativo adicione leads às suas campanhas de e-mail e interrompa as sequências deles."
      width="narrow"
    >
      {canManage ? (
        <ApiKeysSettings initialKeys={keys} />
      ) : (
        <Callout tone="info">Apenas proprietários e administradores podem gerenciar chaves de API.</Callout>
      )}
    </SettingsPage>
  );
}
