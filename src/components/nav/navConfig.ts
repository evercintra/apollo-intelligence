import {
  RiBarChartBoxLine,
  RiBookOpenLine,
  RiBugLine,
  RiLightbulbLine,
  RiShieldCheckLine,
  RiChat3Line,
  RiFilter3Line,
  RiGlobalLine,
  RiHistoryLine,
  RiInboxLine,
  RiLinkM,
  RiMegaphoneLine,
  RiChatSmile2Line,
  RiPhoneLine,
  RiSearchLine,
  RiSendPlaneLine,
  RiWebhookLine,
  RiCodeSSlashLine,
  RiDatabase2Line,
  RiGridLine,
  RiLinkedinBoxFill,
  RiMailFill,
  RiRouteLine,
  RiSettings3Line,
  RiTimeLine,
  RiTodoLine,
  RiUserSearchLine,
  RiWhatsappFill,
  type RemixiconComponentType,
} from "@remixicon/react";
import { HUE } from "@/components/analytics/theme";
import { APP_VERSION, bugReportUrl, SUPPORT_LINKS } from "@/lib/support";
import { SETTINGS_HOME, SETTINGS_NAV } from "@/components/settings/settingsNav";

/**
 * The app's navigation, shared by the sidebar and the ⌘K palette.
 *
 * Shape: a few labelled sections of links and collapsible groups (one group
 * per outreach channel), plus footer entries pinned to the bottom. A link's
 * `match` lists extra path prefixes that should light it up (a record page
 * belongs to Leads).
 */

/** Live counts from GET /api/nav/badges. */
export type NavBadges = {
  actionRequired: number;
  whatsappUnread: number;
  draftsAwaitingReview: number;
  /** Failing mailboxes + disconnected LinkedIn and WhatsApp accounts. */
  accountsNeedingAttention: number;
};
export type NavBadgeKey = keyof NavBadges;

export type NavLink = {
  kind: "link";
  href: string;
  label: string;
  icon: RemixiconComponentType;
  badge?: NavBadgeKey;
  /** "count" shows the number; "dot" only flags that something needs a look. */
  badgeStyle?: "count" | "dot";
  match?: string[];
};

export type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: RemixiconComponentType;
  color?: string;
  children: NavLink[];
  /** Closed until opened, unless it holds the current page. */
  defaultOpen?: boolean;
};

export type NavEntry = NavLink | NavGroup;
export type NavSection = { label?: string; entries: NavEntry[] };

const link = (href: string, label: string, icon: RemixiconComponentType, extra: Partial<NavLink> = {}): NavLink => ({ kind: "link", href, label, icon, ...extra });

export const NAV_SECTIONS: NavSection[] = [
  {
    entries: [
      link("/analytics", "Análises", RiBarChartBoxLine),
      link("/crm/actions", "Ação necessária", RiTodoLine, { badge: "actionRequired" }),
      link("/leads", "Leads", RiUserSearchLine, { match: ["/crm/records"] }),
    ],
  },
  {
    label: "Prospecção",
    entries: [
      {
        kind: "group",
        id: "email",
        label: "Email",
        icon: RiMailFill,
        color: HUE.orange,
        children: [
          link("/outreach/campaigns", "Campanhas", RiSendPlaneLine),
          link("/outreach/inbox", "Caixa de entrada", RiInboxLine),
        ],
      },
      {
        kind: "group",
        id: "linkedin",
        label: "LinkedIn",
        icon: RiLinkedinBoxFill,
        color: HUE.blue,
        children: [
          link("/linkedin/campaigns", "Campanhas", RiMegaphoneLine),
          link("/linkedin/messages", "Mensagens", RiChat3Line),
          link("/linkedin/search", "Busca", RiSearchLine),
        ],
      },
      {
        kind: "group",
        id: "whatsapp",
        label: "WhatsApp",
        icon: RiWhatsappFill,
        color: HUE.green,
        children: [
          link("/whatsapp/campaigns", "Campanhas de mensagens", RiChatSmile2Line, { match: ["/whatsapp/"] }),
          link("/calling/campaigns", "Campanhas de ligação", RiPhoneLine, { match: ["/calling/"] }),
          link("/calling/messages", "Mensagens", RiChat3Line, { badge: "whatsappUnread" }),
        ],
      },
    ],
  },
  {
    label: "CRM",
    entries: [
      link("/crm/pipeline", "Pipeline", RiRouteLine),
      link("/crm/sequences", "Sequências", RiTimeLine),
    ],
  },
  {
    label: "Dados",
    entries: [
      link("/tables", "Tabelas", RiGridLine),
      {
        kind: "group",
        id: "prospecting",
        label: "Prospecção",
        icon: RiDatabase2Line,
        children: [
          link("/domains", "Domínios brasileiros", RiGlobalLine),
          link("/campaigns", "Campanhas de qualificação", RiFilter3Line),
        ],
      },
    ],
  },
];

export const NAV_FOOTER: NavEntry[] = [
  {
    kind: "group",
    id: "developers",
    label: "Desenvolvedores",
    icon: RiCodeSSlashLine,
    children: [
      link("/linkedin/connections", "Conexões", RiLinkM),
      link("/linkedin/jobs", "Histórico de tarefas", RiHistoryLine),
      link("/linkedin/webhooks", "Webhooks do LinkedIn", RiWebhookLine),
    ],
  },
  link(SETTINGS_HOME, "Configurações", RiSettings3Line, { match: ["/settings"], badge: "accountsNeedingAttention", badgeStyle: "dot" }),
];

export function allLinks(): NavLink[] {
  const entries = [...NAV_SECTIONS.flatMap((s) => s.entries), ...NAV_FOOTER];
  return entries.flatMap((e) => (e.kind === "group" ? e.children : [e]));
}

/** The one link that owns `pathname`: the longest matching href or `match` prefix. */
export function activeHref(pathname: string): string | undefined {
  let best: { href: string; length: number } | undefined;
  for (const l of allLinks()) {
    for (const prefix of [l.href, ...(l.match ?? [])]) {
      const hit = pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`);
      if (hit && (!best || prefix.length > best.length)) best = { href: l.href, length: prefix.length };
    }
  }
  return best?.href;
}

/** Every destination for the ⌘K palette: nav pages, settings screens, and "create" shortcuts. */
export type PaletteItem = { href: string; label: string; group: string; icon: RemixiconComponentType; keywords?: string; /** Opens in a new tab instead of navigating in the app. */ external?: boolean };

export function paletteItems(): PaletteItem[] {
  const items: PaletteItem[] = [];
  for (const section of NAV_SECTIONS) {
    for (const e of section.entries) {
      if (e.kind === "link") items.push({ href: e.href, label: e.label, group: section.label ?? "Páginas", icon: e.icon });
      else for (const c of e.children) items.push({ href: c.href, label: `${e.label} · ${c.label}`, group: section.label ?? "Páginas", icon: c.icon });
    }
  }
  for (const e of NAV_FOOTER) {
    if (e.kind === "group") for (const c of e.children) items.push({ href: c.href, label: c.label, group: e.label, icon: c.icon });
  }
  for (const g of SETTINGS_NAV) {
    for (const s of g.items) {
      if (!s.tabs) items.push({ href: s.href, label: s.label, group: "Configurações", icon: s.icon, keywords: g.label });
      else for (const t of s.tabs) items.push({ href: t.href, label: `${s.label} · ${t.label}`, group: "Configurações", icon: t.icon, keywords: g.label });
    }
  }
  items.push(
    { href: "/outreach/campaigns/new", label: "Nova campanha de e-mail", group: "Criar", icon: RiMailFill },
    { href: "/linkedin/campaigns/new", label: "Nova campanha no LinkedIn", group: "Criar", icon: RiLinkedinBoxFill },
  );
  items.push(
    { href: SUPPORT_LINKS.docs, label: "Documentação", group: "Ajuda", icon: RiBookOpenLine, external: true },
    { href: bugReportUrl(APP_VERSION), label: "Reportar um problema", group: "Ajuda", icon: RiBugLine, external: true },
    { href: SUPPORT_LINKS.featureRequest, label: "Sugerir uma funcionalidade", group: "Ajuda", icon: RiLightbulbLine, external: true },
    { href: SUPPORT_LINKS.community, label: "Perguntar à comunidade", group: "Ajuda", icon: RiChat3Line, external: true },
    { href: SUPPORT_LINKS.security, label: "Reportar uma falha de segurança", group: "Ajuda", icon: RiShieldCheckLine, external: true },
  );
  return items;
}
