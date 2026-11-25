"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
  variant?: "default" | "primary";
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  className = "",
  size = "md",
  variant = "default",
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const isPrimary = variant === "primary";
  const isSm = size === "sm";

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`
          w-full flex items-center justify-between gap-2 rounded-lg border text-left
          transition-all duration-150 focus:outline-none
          ${isSm ? "px-3 py-1.5 text-xs" : "px-3 py-2.5 text-sm"}
          ${isPrimary
            ? "border-[var(--color-action-ring)] bg-[var(--color-complement-surface)] text-[var(--color-complement-deep)] font-semibold focus:ring-2 focus:ring-[var(--color-action-ring)]"
            : "border-[var(--color-stroke-soft-200)] bg-[var(--color-bg-white-0)] text-[var(--color-text-strong-950)] hover:border-[var(--color-stroke-sub-300)] focus:ring-2 focus:ring-[var(--color-action-ring)]"
          }
          ${open ? (isPrimary ? "ring-2 ring-[var(--color-action-ring)]" : "border-[var(--color-stroke-sub-300)] ring-2 ring-[var(--color-action-ring)]") : ""}
        `}
      >
        <span className={selected ? "" : "text-text-strong-950/50"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={`shrink-0 text-text-strong-950/50 transition-transform duration-200 ${open ? "rotate-180" : ""} ${isSm ? "w-3 h-3" : "w-4 h-4"}`}
          viewBox="0 0 20 20" fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[160px] overflow-hidden rounded-xl border border-[var(--color-stroke-soft-200)] bg-[var(--color-bg-white-0)] shadow-xl shadow-black/10">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`
                w-full text-left flex flex-col gap-0.5 px-3 py-2.5 text-sm transition-colors
                ${opt.value === value
                  ? "bg-[var(--color-complement-surface)] text-[var(--color-complement-deep)] font-medium"
                  : "text-[var(--color-text-strong-950)] hover:bg-[var(--color-bg-weak-50)]"
                }
              `}
            >
              <span>{opt.label}</span>
              {opt.description && (
                <span className="text-xs text-text-strong-950/50 font-normal">{opt.description}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
