import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";

export const metadata = { title: "Conexão do LinkedIn" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ConnectionSettingsPage platforms={[{ platform: "unipile", note: "A mesma conexão Unipile também alimenta o WhatsApp; alterá-la aqui afeta o WhatsApp." }]} title="Conexão do LinkedIn" description="A Unipile conecta suas contas do LinkedIn para convites, mensagens, busca e sincronização da caixa de entrada." />;
}
