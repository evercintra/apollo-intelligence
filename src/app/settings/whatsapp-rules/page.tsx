import { RulesSettingsPage } from "@/components/settings/ChannelSettingsPages";

export const metadata = { title: "Regras de envio do WhatsApp" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <RulesSettingsPage channel="whatsapp" title="Regras de envio do WhatsApp" description="A rapidez com que os números podem iniciar conversas e enviar mensagens. O WhatsApp bloqueia números que enviam mensagens para muitos desconhecidos rapidamente." />;
}
