import type { Metadata } from "next";
import { SettingsShell } from "@/components/settings/SettingsShell";

export const metadata: Metadata = {
  title: {
    default: "Configurações · Apollo Intelligence",
    template: "%s · Configurações · Apollo Intelligence",
  },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsShell>{children}</SettingsShell>;
}
