"use client";

import { RiMoonLine, RiSunLine } from "@remixicon/react";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useTheme } from "@/components/theme/ThemeProvider";
import { ThemeSwitch } from "@/components/theme/ThemeSwitch";
import { FieldRow } from "./SettingsKit";

const SHOWING = {
  light: { label: "Claro", icon: RiSunLine },
  dark: { label: "Escuro", icon: RiMoonLine },
} as const;

/** The Appearance section: the Light / Dark / System switch and what it is doing right now. */
export default function AppearanceSettings() {
  const { preference, resolved } = useTheme();
  const Showing = SHOWING[resolved].icon;

  return (
    <Frame>
      <FrameHeader title="Aparência" description="Como o Apollo aparece neste navegador." />
      <FramePanel>
        <FieldRow
          label="Tema"
          description="A opção Sistema segue a configuração de tema claro ou escuro do computador e muda junto com ela."
        >
          <ThemeSwitch className="w-full" />
          {preference === "system" && (
            <p className="mt-2 flex items-center gap-1.5 text-paragraph-xs text-text-sub-600">
              <Showing className="size-3.5 shrink-0 text-text-sub-600" aria-hidden="true" />
              Exibindo tema {SHOWING[resolved].label.toLowerCase()}, conforme a configuração do sistema
            </p>
          )}
        </FieldRow>
      </FramePanel>
      <FrameFooter>
        Lembrado apenas neste navegador. Outros navegadores e dispositivos mantêm sua própria escolha; nada é salvo no seu espaço de trabalho.
      </FrameFooter>
    </Frame>
  );
}
