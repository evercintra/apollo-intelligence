import { Suspense } from "react";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { RequiresPlatform } from "@/components/settings/RequiresPlatform";
import { AccountsClient } from "@/components/linkedin/AccountsClient";
import { ConnectAccountButton, HostedAuthReturn } from "@/components/linkedin/HostedAuth";
import { requirePageOrgContext } from "@/lib/auth/context";
import { runInOrganization } from "@/lib/tenancy/scope";
import { loadConnectedAccounts } from "@/lib/linkedin/connectedAccounts.server";
import { channelRules } from "@/lib/channels/rules.server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Contas do LinkedIn" };

async function Accounts() {
  const ctx = await requirePageOrgContext();
  const [{ accountRows, sentTodayMap, pendingLeadsMap }, rules] = await runInOrganization(ctx.organizationId, () =>
    Promise.all([loadConnectedAccounts(), channelRules("linkedin")]),
  );

  return (
    <>
      <Suspense fallback={null}>
        <HostedAuthReturn />
      </Suspense>

      <AccountsClient
        accounts={accountRows}
        sentTodayMap={sentTodayMap}
        pendingLeadsMap={pendingLeadsMap}
        inviteLimits={{ premium: rules.invitesPerDayPremium, free: rules.invitesPerDayFree }}
      />
    </>
  );
}

export default function LinkedInAccountsPage() {
  return (
    <SettingsPage
      title="Contas do LinkedIn"
      description="Os perfis do LinkedIn usados pelas campanhas, conectados pela Unipile."
      actions={
        <RequiresPlatform platform="unipile" fallback={null}>
          <ConnectAccountButton />
        </RequiresPlatform>
      }
    >
      <RequiresPlatform platform="unipile">
        <Accounts />
      </RequiresPlatform>
    </SettingsPage>
  );
}
