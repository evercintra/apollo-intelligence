import { ConnectionSettingsPage } from "@/components/settings/ChannelSettingsPages";

export const metadata = { title: "Conexão de e-mail" };
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <ConnectionSettingsPage
      platforms={[{ platform: "google" }]}
      comingSoon={[
        {
          name: "Microsoft Outlook",
          description: "Envie e leia e-mails de caixas do Microsoft 365 e do Outlook, conectadas pelo Microsoft Azure.",
          iconUrl: "/Integrations - Icon/microsoft.svg",
          enables: ["caixas do Outlook", "campanhas de e-mail", "sincronização da caixa de entrada"],
        },
      ]}
      title="Conexão de e-mail"
      description="A conta de serviço do Google Workspace que envia e lê o Gmail de cada caixa em E-mail → Contas. Microsoft Outlook em breve."
    />
  );
}
