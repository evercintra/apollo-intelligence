import type { ComponentType, CSSProperties } from "react";
import { MUTED } from "../theme";

export type DonutItem = {
  key: string;
  label: string;
  value: number;
  color: string;
  icon?: ComponentType<{ className?: string; style?: CSSProperties }>;
};

export function foldDonutItems(items: readonly DonutItem[], maxSlices = 6): DonutItem[] {
  const nonZero = items.filter((item) => item.value > 0);
  const limit = Math.max(1, Math.floor(maxSlices));
  if (nonZero.length <= limit) return nonZero.map((item) => ({ ...item }));
  const keep = new Set(
    [...nonZero]
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
      .slice(0, limit - 1)
      .map((item) => item.key),
  );
  const rest = nonZero.filter((item) => !keep.has(item.key));
  return [
    ...nonZero.filter((item) => keep.has(item.key)).map((item) => ({ ...item })),
    {
      key: "__other",
      label: `Outros (${rest.length})`,
      value: rest.reduce((sum, item) => sum + item.value, 0),
      color: MUTED,
    },
  ];
}
