import { RulesSettingsPage } from "@/components/settings/ChannelSettingsPages";

export const metadata = { title: "Regras de envio de e-mail" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <RulesSettingsPage channel="email" title="Regras de envio de e-mail" description="A rapidez e os horários de envio das caixas. Os padrões servem para uma caixa aquecida do Google Workspace; altere-os apenas se conhecer sua reputação de envio." />;
}
