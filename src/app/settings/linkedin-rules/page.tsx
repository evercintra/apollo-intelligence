import { RulesSettingsPage } from "@/components/settings/ChannelSettingsPages";

export const metadata = { title: "Regras de envio do LinkedIn" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <RulesSettingsPage channel="linkedin" title="Regras de envio do LinkedIn" description="Quantos convites e mensagens cada conta envia, com que rapidez e em quais horários. O LinkedIn restringe contas que agem rápido demais, por isso os padrões são conservadores." />;
}
