import type { CSSProperties } from "react";
import { cn } from "@/utils/cn";
import { brandDisplayClass } from "./font";
import styles from "./logo.module.css";
import type { MascotCycle } from "./mascotFrames";

export const ICON_RADIUS = "22%";

const WALK_MS: Record<MascotCycle, number> = {
  step: 900,
  bounce: 700,
  waddle: 1200,
  scuttle: 500,
};

export type Walk = {
  walk?: MascotCycle;
  walkOn?: "always" | "hover";
};

function ApolloGlyph({
  className,
  cutClassName = "text-brand-surface",
  walk,
  walkOn = "always",
}: {
  className?: string;
  cutClassName?: string;
} & Walk) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className, walk && (walkOn === "hover" ? styles.walkHover : styles.walkAlways))}
      style={walk ? ({ "--walk-duration": `${WALK_MS[walk]}ms` } as CSSProperties) : undefined}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M16 4L28 27H22.8L16 13.4L9.2 27H4L16 4Z"
        fill="currentColor"
      />
      <path
        d="M11.2 21.5H20.8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className={cutClassName}
      />
      <circle cx="25.5" cy="7" r="2.5" fill="currentColor" />
    </svg>
  );
}

export function AppIcon({
  className,
  small = false,
  walk,
  walkOn = "always",
}: {
  className?: string;
  small?: boolean;
} & Walk) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-brand-surface text-brand-on-surface",
        "ring-1 ring-inset ring-white/[0.08]",
        small
          ? "shadow-[0_2px_8px_rgb(0_0_0/0.18)]"
          : "shadow-[0_8px_24px_rgb(0_0_0/0.24)]",
        className,
      )}
      style={{ borderRadius: ICON_RADIUS }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgb(197_244_103/0.12),transparent_70%)]" />
      <ApolloGlyph className="relative size-[68%] drop-shadow-[0_0_8px_rgb(197_244_103/0.15)]" walk={walk} walkOn={walkOn} />
    </span>
  );
}

export function AgentMark({
  className,
  cutClassName,
}: {
  className?: string;
  cutClassName?: string;
}) {
  return <ApolloGlyph className={className} cutClassName={cutClassName} />;
}

export function Logo({
  className,
  iconClassName = "size-7",
  textClassName = "text-[19px]",
  walk,
  walkOn,
}: {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
} & Walk) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <AppIcon small className={iconClassName} walk={walk} walkOn={walkOn} />
      <span className="inline-flex flex-col justify-center gap-[3px]">
        <span
          className={cn(
            brandDisplayClass,
            "leading-none tracking-[0.025em]",
            textClassName,
          )}
        >
          APOLLO
        </span>
        <span className="text-[8px] font-semibold leading-none tracking-[0.24em] text-current opacity-60">
          INTELLIGENCE
        </span>
      </span>
    </span>
  );
}
