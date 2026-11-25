const TONE_CLS = {
  slate: "bg-bg-weak-50 text-text-sub-600",
  indigo: "bg-complement-surface text-complement-deep",
  emerald: "bg-success-lighter dark:bg-success-base/10 text-success-dark dark:text-success-base",
  amber: "bg-warning-lighter dark:bg-warning-base/10 text-warning-dark dark:text-warning-base",
  red: "bg-error-lighter dark:bg-error-base/10 text-error-dark dark:text-error-base",
  sky: "bg-information-lighter dark:bg-information-base/10 text-information-dark dark:text-information-base",
} as const;

export type BadgeTone = keyof typeof TONE_CLS;

/** Pill status badge with a leading dot — the recurring status-chip pattern used across campaign/lead tables. */
export default function Badge({
  label,
  tone = "slate",
  dot = true,
}: {
  label: string;
  tone?: BadgeTone;
  dot?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${TONE_CLS[tone]}`}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {label}
    </span>
  );
}
