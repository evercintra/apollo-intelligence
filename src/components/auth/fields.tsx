"use client";

import { useId, useState } from "react";
import { RiEyeLine, RiEyeOffLine } from "@remixicon/react";
import { cn } from "@/utils/cn";

/**
 * The auth pages' form pieces. They sit on AuthShell's fixed dark
 * background, so colours are tied to the Apollo palette rather than the app
 * theme.
 */

export function Spinner() {
  return (
    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/**
 * A labelled input. `labelAside` sits at the right end of the label row
 * (e.g. "Esqueceu a senha?"). A password input gets a show/hide toggle.
 */
export function Field({
  label,
  labelAside,
  hint,
  className,
  type,
  ...props
}: { label: string; labelAside?: React.ReactNode; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-apollo-soft-white">
          {label}
        </label>
        {labelAside && <span className="text-xs">{labelAside}</span>}
      </div>
      <div className="relative">
        <input
          id={id}
          type={isPassword && revealed ? "text" : type}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={cn(
            "h-11 w-full rounded-lg border border-apollo-purple-300/20 bg-apollo-graphite-900/60 px-3.5 text-sm text-apollo-soft-white placeholder:text-apollo-graphite-400 transition-colors hover:border-apollo-purple-300/40 focus:border-apollo-lime-400/60 focus:bg-apollo-graphite-900 focus:outline-none focus:ring-2 focus:ring-apollo-lime-400/30",
            isPassword && "pr-11",
            className,
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
            aria-pressed={revealed}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-apollo-purple-300 transition-colors hover:text-apollo-soft-white focus-visible:text-apollo-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/50"
          >
            {revealed ? <RiEyeOffLine className="size-[18px]" /> : <RiEyeLine className="size-[18px]" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-apollo-graphite-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function ErrorCallout({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-sm leading-relaxed text-red-200">
      {children}
    </div>
  );
}

export function InfoCallout({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" className="rounded-lg border border-apollo-purple-400/40 bg-apollo-purple-500/10 px-3 py-2.5 text-sm leading-relaxed text-apollo-purple-200">
      {children}
    </div>
  );
}

/** The form's primary action: a light button on the dark page. */
export function SubmitButton({
  loading,
  loadingLabel,
  children,
  disabled,
}: {
  loading: boolean;
  loadingLabel: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="h-11 w-full rounded-lg bg-apollo-lime-400 text-sm font-semibold text-apollo-graphite-900 shadow-[inset_0_-1px_0_rgb(15_18_14/0.18)] transition-colors hover:bg-apollo-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-apollo-graphite-950 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export function SecondaryButton({
  loading,
  className,
  children,
  ...props
}: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={loading || props.disabled}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-apollo-purple-300/20 bg-apollo-graphite-900/60 text-sm font-medium text-apollo-soft-white transition-colors hover:border-apollo-purple-300/40 hover:bg-apollo-graphite-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Quiet inline links ("Esqueceu a senha?") and footer actions ("Crie uma"). */
export const linkClass = "font-medium text-apollo-soft-white underline-offset-4 transition-colors hover:text-apollo-lime-300 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apollo-lime-400/50";
export const quietLinkClass = "text-apollo-purple-300 underline-offset-4 transition-colors hover:text-apollo-soft-white hover:underline";
