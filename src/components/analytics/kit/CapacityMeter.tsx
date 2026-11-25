import { RiAlertLine, RiCheckLine, RiErrorWarningLine } from "@remixicon/react";
import { cn } from "@/utils/cn";

/**
 * Segmented meter for used / limit (daily send caps, warm-up limits). The fill
 * shifts accent -> warning at 80% -> critical at 100%; the state is also
 * written out with an icon ("Near limit", "At limit"), never colour alone. The
 * unfilled track uses Apollo lilac so the state reads across the whole bar.
 *
 * Props: `label`, `used`, `limit`, `segments` (default 20), `detail` (small
 * text under the label, e.g. an email address).
 */
const TONES = {
  ok: { fill: "var(--color-accent-base)", track: "bg-complement-light dark:bg-complement-deep/50", icon: "text-accent-ring" },
  warning: { fill: "var(--color-brand-surface)", track: "bg-complement-light dark:bg-complement-deep/50", icon: "text-text-strong-950" },
  critical: { fill: "var(--color-complement-deep)", track: "bg-complement-light dark:bg-complement-deep/50", icon: "text-complement-deep" },
} as const;

export function CapacityMeter({ label, used, limit, segments = 20, detail }: { label: string; used: number; limit: number; segments?: number; detail?: string }) {
  const fraction = limit > 0 ? used / limit : 0;
  const state = fraction >= 1 ? "critical" : fraction >= 0.8 ? "warning" : "ok";
  const tone = TONES[state];
  const filled = used <= 0 ? 0 : Math.min(segments, Math.max(1, Math.round(fraction * segments)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-label-sm text-text-strong-950">{label}</p>
          {detail && <p className="truncate text-paragraph-xs text-text-sub-600">{detail}</p>}
        </div>
        <p className="shrink-0 text-label-sm text-text-strong-950">
          {used.toLocaleString("pt-BR")} <span className="text-text-sub-600">/ {limit.toLocaleString("pt-BR")}</span>
        </p>
      </div>
      <div role="meter" aria-label={`Uso de ${label}`} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used} className="mt-2.5 flex h-2 gap-0.5 rounded-full bg-complement-light p-0.5 dark:bg-complement-deep/50">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={cn("h-full flex-1 rounded-[2px]", i >= filled && tone.track)} style={i < filled ? { backgroundColor: tone.fill } : undefined} />
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-paragraph-xs font-medium text-text-sub-600">
        {state === "ok" && <RiCheckLine className={cn("size-3.5", tone.icon)} aria-hidden="true" />}
        {state === "warning" && <RiAlertLine className={cn("size-3.5", tone.icon)} aria-hidden="true" />}
        {state === "critical" && <RiErrorWarningLine className={cn("size-3.5", tone.icon)} aria-hidden="true" />}
        {state === "ok" ? "Dentro do limite" : state === "warning" ? "Perto do limite" : "No limite"}
      </p>
    </div>
  );
}
