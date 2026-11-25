import { WhatsappMessagesClient } from "@/components/whatsapp/WhatsappMessagesClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Mensagens" };

export default async function CallingMessagesPage({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const { chat } = await searchParams;
  return <WhatsappMessagesClient initialChatId={chat ?? null} />;
}
