import type { Metadata } from "next";

/**
 * WhatsApp Calling pages share the LinkedIn section's padded, scrolling
 * content surface, and — unlike the CRM pages they used to borrow — carry no
 * CRM tabs. The global app shell supplies the sidebar.
 *
 * Not gated on Unipile: calls go through WhatsApp Web (the rep's own, or a
 * calling station's), and a station's number also messages without Unipile.
 * What still needs Unipile (syncing Unipile numbers) says so where it is used.
 */
export const metadata: Metadata = {
  title: {
    default: "Chamadas do WhatsApp · Apollo Intelligence",
    template: "%s · Chamadas do WhatsApp · Apollo Intelligence",
  },
  description: "Ligue para leads pelo WhatsApp e faça follow-up",
};

export default function CallingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative h-full overflow-auto bg-bg-white-0 px-4 py-5 text-text-strong-950 sm:px-6 sm:py-6 lg:px-8">
      {children}
    </main>
  );
}
