"use client";

import { useEffect, useRef } from "react";

export function LeadSelectCheckbox({
  checked,
  indeterminate,
  onChange,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate);
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={onClick}
      aria-label={ariaLabel}
      className="h-4 w-4 cursor-pointer rounded border-stroke-sub-300 accent-apollo-lime-500 outline-none transition focus-visible:ring-2 focus-visible:ring-accent-ring"
    />
  );
}
