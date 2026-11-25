import {
  RiBookOpenLine,
  RiBuilding2Line,
  RiCpuLine,
  RiEqualizerLine,
  RiGroupLine,
  RiKey2Line,
  RiRobot2Line,
  RiTeamLine,
  RiLayoutColumnLine,
  RiLinkedinBoxLine,
  RiMailLine,
  RiPhoneLine,
  RiPlugLine,
  RiPaletteLine,
  RiPriceTag3Line,
  RiQuillPenLine,
  RiWhatsappLine,
  type RemixiconComponentType,
} from "@remixicon/react";

export type SettingsTab = { href: string; label: string; icon: RemixiconComponentType };

/** A row in the settings rail. With `tabs`, it opens the first and stays active on any of them. */
export type SettingsNavItem = SettingsTab & { tabs?: SettingsTab[] };

/** Every page a row covers: itself, or its tabs. */
export function itemPages(item: SettingsNavItem): SettingsTab[] {
  return item.tabs ?? [item];
}

/**
 * Every settings screen in the app. Each is its own route under /settings;
 * the pages they replaced redirect here (next.config.ts).
 */
export const SETTINGS_NAV: { label: string; items: SettingsNavItem[] }[] = [
  {
    label: "Organização",
    items: [
      { href: "/settings/organization", label: "Geral", icon: RiBuilding2Line },
      { href: "/settings/members", label: "Membros", icon: RiGroupLine },
      { href: "/settings/teams", label: "Equipes", icon: RiTeamLine },
      { href: "/settings/api-keys", label: "Chaves de API", icon: RiKey2Line },
      { href: "/settings/ai-assistants", label: "Assistentes de IA", icon: RiRobot2Line },
    ],
  },
  // Each channel is one row here; its pages — the connected accounts, the
  // integration it runs on, its sending rules (src/lib/channels/rules.ts) —
  // are tabs across the top of the section (SettingsShell).
  {
    label: "Canais",
    items: [
      {
        href: "/settings/email-accounts",
        label: "Email",
        icon: RiMailLine,
        tabs: [
          { href: "/settings/email-accounts", label: "Caixas de e-mail", icon: RiMailLine },
          { href: "/settings/email-connection", label: "Conexão", icon: RiPlugLine },
          { href: "/settings/email-rules", label: "Regras de envio", icon: RiEqualizerLine },
        ],
      },
      {
        href: "/settings/linkedin-accounts",
        label: "LinkedIn",
        icon: RiLinkedinBoxLine,
        tabs: [
          { href: "/settings/linkedin-accounts", label: "Contas", icon: RiLinkedinBoxLine },
          { href: "/settings/linkedin-connection", label: "Conexão", icon: RiPlugLine },
          { href: "/settings/linkedin-rules", label: "Regras de envio", icon: RiEqualizerLine },
        ],
      },
      {
        href: "/settings/whatsapp-accounts",
        label: "WhatsApp",
        icon: RiWhatsappLine,
        tabs: [
          { href: "/settings/whatsapp-accounts", label: "Números", icon: RiWhatsappLine },
          { href: "/settings/whatsapp-stations", label: "Números de ligação", icon: RiPhoneLine },
          { href: "/settings/whatsapp-connection", label: "Integrações", icon: RiPlugLine },
          { href: "/settings/whatsapp-rules", label: "Regras de envio", icon: RiEqualizerLine },
        ],
      },
    ],
  },
  {
    label: "IA",
    items: [
      { href: "/settings/instructions", label: "Instruções", icon: RiQuillPenLine },
      { href: "/settings/knowledge", label: "Conhecimento", icon: RiBookOpenLine },
      { href: "/settings/ai", label: "Provedor de IA", icon: RiCpuLine },
    ],
  },
  {
    label: "CRM e leads",
    items: [
      { href: "/settings/lead-categories", label: "Categorias de leads", icon: RiPriceTag3Line },
      { href: "/settings/columns", label: "Colunas de leads", icon: RiLayoutColumnLine },
    ],
  },
  {
    label: "Preferências",
    items: [{ href: "/settings/appearance", label: "Aparência", icon: RiPaletteLine }],
  },
];

/** Where "Settings" opens. */
export const SETTINGS_HOME = SETTINGS_NAV[0].items[0].href;

