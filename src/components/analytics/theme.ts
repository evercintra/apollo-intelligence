import { RiLinkedinBoxFill, RiMailFill, RiWhatsappFill } from "@remixicon/react";
import type { ComponentType } from "react";
import type { AnalyticsChannel } from "@/lib/analytics/contract";

export const HUE = {
  blue: "#335cff",
  orange: "#fa7319",
  green: "#1fc16b",
  purple: "#7d52f4",
  teal: "#1daf9c",
  amber: "#e5930a",
  pink: "#fb4ba3",
  sky: "#35ade9",
  red: "#fb3748",
} as const;

export const APOLLO = {
  purple: "#49345F",
  lavender: "#9582A8",
  lilac: "#DCD2E8",
  graphite: "#20251F",
  lime: "#C5F467",
  soft: "#F6F2FA",
  olive: "#6F8F5B",
  amber: "#B7791F",
  rose: "#B3465A",
  plum: "#B05A8A",
  slate: "#6E86A8",
} as const;

export const CHANNEL = {
  linkedin: APOLLO.purple,
  email: APOLLO.lavender,
  whatsapp: "#117A4A",
} as const;

export const CHANNEL_META: Record<
  AnalyticsChannel,
  { label: string; color: string; icon: ComponentType<{ className?: string }> }
> = {
  linkedin: { label: "LinkedIn", color: CHANNEL.linkedin, icon: RiLinkedinBoxFill },
  email: { label: "E-mail", color: CHANNEL.email, icon: RiMailFill },
  whatsapp: { label: "WhatsApp", color: CHANNEL.whatsapp, icon: RiWhatsappFill },
};

export const CATEGORICAL_EXTRA = [APOLLO.lilac, APOLLO.graphite, APOLLO.olive, APOLLO.amber, APOLLO.plum] as const;
export const ACCENT = APOLLO.purple;
export const ORDINAL_BLUE = ["#97baff", "#739eff", "#4d82ff", "#335cff", "#2547d0", "#1f3bad"] as const;
export const APOLLO_RAMP = ["#DCD2E8", "#C6B7D6", "#AD98BF", "#9582A8", "#6F5A85", "#49345F"] as const;
export const MUTED = "var(--chart-muted)";
export const MUTED_STRONG = "var(--chart-muted-strong)";

export const STATUS = {
  good: HUE.green,
  warning: HUE.amber,
  serious: HUE.orange,
  critical: HUE.red,
} as const;

export const CRM_CATEGORY_COLOR = {
  interested: HUE.teal,
  customer: HUE.purple,
  not_interested: HUE.red,
  other: HUE.amber,
  unclassified: MUTED,
} as const;

export const GRID_STROKE = "var(--color-stroke-soft-200)";
export const AXIS_TEXT = "var(--color-text-soft-400)";
export const SURFACE = "var(--color-bg-white-0)";

export function ordinalRamp(count: number): string[] {
  if (count <= 1) return [APOLLO_RAMP[3]];
  return Array.from({ length: count }, (_, i) => APOLLO_RAMP[Math.round((i * (APOLLO_RAMP.length - 1)) / (count - 1))]);
}

const decimal = (value: number) => value.toFixed(1).replace(/\.0$/, "").replace(".", ",");

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs < 10_000) return Math.round(value).toLocaleString("pt-BR");
  if (abs < 1_000_000) return `${decimal(value / 1_000)} mil`;
  if (abs < 1_000_000_000) return `${decimal(value / 1_000_000)} mi`;
  return `${decimal(value / 1_000_000_000)} bi`;
}

export function formatPercent(value: number | null | undefined, digits?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const pct = value * 100;
  const d = digits ?? (Math.abs(pct) < 10 && pct !== 0 ? 1 : 0);
  return `${pct.toFixed(d).replace(/\.0$/, "").replace(".", ",")}%`;
}

export function formatChange(value: number): string {
  const pct = Math.abs(value * 100);
  const text = pct < 10 ? decimal(pct) : Math.round(pct).toLocaleString("pt-BR");
  return `${value < 0 ? "−" : "+"}${text}%`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

export function formatMinutes(minutes: number | null | undefined): string {
  return minutes === null || minutes === undefined ? "—" : formatDuration(minutes * 60_000);
}

export type DeltaTone = "good" | "bad" | "neutral";

export function deltaTone(change: number | null, upIsGood = true): DeltaTone {
  if (change === null || Math.abs(change) < 0.005) return "neutral";
  return change > 0 === upIsGood ? "good" : "bad";
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function formatDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ""}`;
}

export function formatDayLong(date: string): string {
  return `${formatDay(date)} ${date.slice(0, 4)}`;
}

export function formatBucket(date: string, bucket: "day" | "week", long = false): string {
  if (bucket === "week") return long ? `Semana de ${formatDay(date)}` : formatDay(date);
  return long ? formatDayLong(date) : formatDay(date);
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
