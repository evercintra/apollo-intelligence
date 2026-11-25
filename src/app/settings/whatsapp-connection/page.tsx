import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";
import { RecorderExtensionCard } from "@/components/settings/RecorderExtensionCard";

export const metadata = { title: "Integrações do WhatsApp" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ConnectionSettingsPage
      platforms={[
        { platform: "unipile", note: "A mesma conexão Unipile também alimenta o LinkedIn; alterá-la aqui afeta o LinkedIn." },
        { platform: "r2" },
        { platform: "gologin", note: "Necessária apenas para números de ligação em nuvem (Configurações → WhatsApp → Números de ligação)." },
        { platform: "calcom", note: "Necessária apenas para campanhas de ligação com IA que agendam reuniões: avisa quando um lead agenda.", webhookUrl: true },
      ]}
      title="Integrações do WhatsApp"
      description="A Unipile conecta seus números de WhatsApp para mensagens e ligações. As ligações feitas pelo Apollo Intelligence são gravadas pela extensão Call Recorder e armazenadas no seu bucket Cloudflare R2, junto com as fotos de contato. A transcrição usa o modelo escolhido em Provedor de IA."
    >
      <RecorderExtensionCard />
    </ConnectionSettingsPage>
  );
}
