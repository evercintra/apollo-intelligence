"use client";

import { RiAlarmWarningLine, RiArrowDownSLine, RiCalendarLine, RiCheckLine, RiDashboard3Line, RiGitBranchLine, RiGlobalLine, RiRefreshLine, RiSearchLine } from "@remixicon/react";
import { createElement, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import * as Popover from "@/components/alignui/popover";
import { ANALYTICS_CHANNELS, dayCount, MAX_ANALYTICS_RANGE_DAYS, type AnalyticsArea, type AnalyticsChannel, type AnalyticsResponse, type AnalyticsView } from "@/lib/analytics/contract";
import { cn } from "@/utils/cn";
import { ErrorState } from "./kit/ErrorState";
import { parseRange, RANGE_PRESETS, resolveRange, serializeRange, type RangeSelection } from "./range";
import { CHANNEL_META, formatDay } from "./theme";
import { views, type ViewProps } from "./views";

const AREA_TABS: Array<{ view: AnalyticsArea; label: string; icon: ComponentType<{ className?: string }> }> = [
  { view: "overview", label: "Visão comercial", icon: RiDashboard3Line },
  { view: "market", label: "Mercado", icon: RiGlobalLine },
  { view: "prospecting", label: "Prospecção", icon: RiSearchLine },
  { view: "pipeline", label: "Pipeline", icon: RiGitBranchLine },
  { view: "actions", label: "Ações", icon: RiAlarmWarningLine },
];

const isChannelView = (view: AnalyticsView): view is AnalyticsChannel => (ANALYTICS_CHANNELS as readonly string[]).includes(view);

function readEnv(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  return `${tz}|${today}`;
}
const noopSubscribe = () => () => {};

type Cached = { data: AnalyticsResponse; key: string; updatedAt: number };

export default function AnalyticsClient({ initialView, initialRange }: { initialView: AnalyticsView; initialRange: string }) {
  const [view, setView] = useState<AnalyticsView>(initialView);
  const [selection, setSelection] = useState<RangeSelection>(() => parseRange(initialRange));
  const env = useSyncExternalStore(noopSubscribe, readEnv, () => null);
  const [tz, today] = env ? env.split("|") : [null, null];

  const [cache, setCache] = useState<Partial<Record<AnalyticsView, Cached>>>({});
  const [settled, setSettled] = useState<{ id: string; error: string | null } | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const resolved = today ? resolveRange(selection, today) : null;
  const fetchKey = resolved && tz ? `${resolved.from}|${resolved.to}|${tz}` : null;

  const requestId = fetchKey ? `${view}|${fetchKey}|${reloadTick}` : null;
  const loading = requestId !== null && settled?.id !== requestId;
  const error = settled?.id === requestId ? settled.error : null;

  useEffect(() => {
    if (!fetchKey || !requestId) return;
    const [from, to, zone] = fetchKey.split("|");
    let current = true;
    fetch(`/api/analytics/${view}?${new URLSearchParams({ from, to, tz: zone })}`)
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as (AnalyticsResponse & { error?: string }) | { error?: string } | null;
        if (!current) return;
        if (!response.ok || !body || "error" in body) throw new Error((body && "error" in body && body.error) || `Falha na solicitação (${response.status})`);
        setCache((prev) => ({ ...prev, [view]: { data: body as AnalyticsResponse, key: fetchKey, updatedAt: Date.now() } }));
        setNow(Date.now());
        setSettled({ id: requestId, error: null });
      })
      .catch((err: unknown) => {
        if (!current) return;
        setSettled({ id: requestId, error: err instanceof Error ? err.message : "Não foi possível carregar a análise" });
      });
    return () => {
      current = false;
    };
  }, [view, fetchKey, requestId]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const syncUrl = useCallback((nextView: AnalyticsView, nextSelection: RangeSelection) => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", nextView);
    url.searchParams.set("range", serializeRange(nextSelection));
    window.history.replaceState(null, "", url);
  }, []);

  const changeView = (next: AnalyticsView) => {
    setView(next);
    syncUrl(next, selection);
  };
  const changeRange = (next: RangeSelection) => {
    setSelection(next);
    syncUrl(view, next);
  };

  const entry = cache[view];
  const showData = entry && !(error && !entry);
  const View = views[view] as unknown as ComponentType<ViewProps<AnalyticsView>>;
  const activeArea: AnalyticsArea = isChannelView(view) ? "prospecting" : (view as AnalyticsArea);

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-title-h5 text-text-strong-950">Inteligência comercial</h1>
          <p className="mt-1 max-w-2xl text-paragraph-sm text-text-sub-600">Empresas, prospecção, pipeline e ações da operação em um só lugar.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
          <DateRangeControl selection={selection} resolved={resolved} today={today} onChange={changeRange} />
          <button type="button" onClick={() => setReloadTick((n) => n + 1)} disabled={loading} aria-label="Atualizar" title="Atualizar" className="flex size-9 items-center justify-center rounded-lg bg-bg-white-0 text-text-sub-600 shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base disabled:opacity-50">
            <RiRefreshLine className={cn("size-4", loading && "animate-spin")} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="mt-6 border-b border-stroke-soft-200">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div role="tablist" aria-label="Áreas de análise" className="-mb-px flex gap-5 overflow-x-auto">
            {AREA_TABS.map(({ view: tabView, label, icon: Icon }) => {
              const active = tabView === activeArea;
              return (
                <button key={tabView} role="tab" type="button" aria-selected={active} onClick={() => changeView(tabView)} className={cn("relative flex h-10 shrink-0 items-center gap-2 text-label-sm outline-none transition-colors focus-visible:text-text-strong-950", active ? "text-text-strong-950" : "text-text-sub-600 hover:text-text-strong-950")}>
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-primary-base" : "text-text-soft-400")} aria-hidden="true" />
                  {label}
                  <span className={cn("absolute inset-x-0 bottom-0 h-0.5 rounded-full", active ? "bg-primary-base" : "bg-transparent")} />
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pb-2 text-paragraph-xs text-text-soft-400">
            {entry && <span>{updatedLabel(entry.updatedAt, now)}</span>}
          </div>
        </div>

        {activeArea === "prospecting" && (
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <span className="mr-1 text-paragraph-xs text-text-soft-400">Canais</span>
            <button type="button" onClick={() => changeView("prospecting")} aria-pressed={view === "prospecting"} className={cn("rounded-lg px-2.5 py-1 text-label-xs outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base", view === "prospecting" ? "bg-bg-weak-50 text-text-strong-950" : "text-text-sub-600 hover:text-text-strong-950")}>
              Visão geral
            </button>
            {ANALYTICS_CHANNELS.map((channel) => {
              const meta = CHANNEL_META[channel];
              const Icon = meta.icon;
              const active = view === channel;
              return (
                <button key={channel} type="button" onClick={() => changeView(channel)} aria-pressed={active} className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-label-xs outline-none transition focus-visible:ring-2 focus-visible:ring-primary-base", active ? "bg-bg-weak-50 text-text-strong-950" : "text-text-sub-600 hover:text-text-strong-950")}>
                  <span style={{ color: meta.color }} aria-hidden="true"><Icon className="size-3.5" /></span>
                  {meta.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div role="tabpanel" className="mt-6">
        {error && entry && <p role="alert" className="mb-4 rounded-lg bg-error-lighter px-3 py-2 text-paragraph-sm text-error-dark">Não foi possível atualizar: {error}. Exibindo os últimos dados carregados.</p>}
        {showData ? (
          createElement(View, { data: entry.data, loading, onSelectView: changeView })
        ) : error ? (
          <ErrorState message={error} onRetry={() => setReloadTick((n) => n + 1)} />
        ) : (
          <LoadingBlock />
        )}
      </div>
    </div>
  );
}

function updatedLabel(updatedAt: number, now: number): string {
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return "Atualizado agora";
  if (minutes < 60) return `Atualizado há ${minutes} min`;
  return `Atualizado há ${Math.floor(minutes / 60)} h`;
}

function LoadingBlock() {
  return (
    <div aria-busy="true" aria-label="Carregando análises" className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="h-32 animate-pulse rounded-2xl bg-bg-weak-50 lg:col-span-12" />
      <div className="h-80 animate-pulse rounded-2xl bg-bg-weak-50 lg:col-span-8" />
      <div className="h-80 animate-pulse rounded-2xl bg-bg-weak-50 lg:col-span-4" />
    </div>
  );
}

function DateRangeControl({ selection, resolved, today, onChange }: { selection: RangeSelection; resolved: { from: string; to: string } | null; today: string | null; onChange: (selection: RangeSelection) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const wasOpen = useRef(false);
  const label = selection.kind === "preset" ? RANGE_PRESETS.find((preset) => preset.key === selection.key)?.label : "Período personalizado";
  const span = resolved ? `${formatDay(resolved.from)} – ${formatDay(resolved.to)}` : "";
  const customError = from && to ? (from > to ? "A data inicial deve ser anterior ao fim." : dayCount(from, to) > MAX_ANALYTICS_RANGE_DAYS ? `Escolha no máximo ${MAX_ANALYTICS_RANGE_DAYS} dias.` : null) : null;

  useEffect(() => {
    if (open && !wasOpen.current && resolved) {
      setFrom(resolved.from);
      setTo(resolved.to);
    }
    wasOpen.current = open;
  }, [open, resolved]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" className="flex h-9 shrink-0 items-center gap-2 self-start rounded-lg bg-bg-white-0 px-3 text-label-sm text-text-strong-950 shadow-regular-xs outline-none ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base">
          <RiCalendarLine className="size-4 text-text-sub-600" aria-hidden="true" />
          {label}
          {span && <span className="hidden text-text-sub-600 sm:inline">· {span}</span>}
          <RiArrowDownSLine className="size-4 text-text-soft-400" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Content align="end" sideOffset={8} showArrow={false} className="w-64 p-1.5">
        <ul>
          {RANGE_PRESETS.map((preset) => {
            const active = selection.kind === "preset" && selection.key === preset.key;
            return (
              <li key={preset.key}>
                <button type="button" onClick={() => { onChange({ kind: "preset", key: preset.key }); setOpen(false); }} className={cn("flex h-9 w-full items-center justify-between rounded-lg px-3 text-label-sm outline-none transition hover:bg-bg-weak-50 focus-visible:bg-bg-weak-50", active ? "text-text-strong-950" : "text-text-sub-600")}>
                  {preset.label}
                  {active && <RiCheckLine className="size-4 text-text-strong-950" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-1.5 border-t border-stroke-soft-200 p-2 pt-3">
          <p className={cn("mb-2 flex items-center justify-between text-label-xs", selection.kind === "custom" ? "text-text-strong-950" : "text-text-soft-400")}>
            Período personalizado {selection.kind === "custom" && <RiCheckLine className="size-4" aria-hidden="true" />}
          </p>
          <div className="flex items-center gap-2">
            <input type="date" aria-label="Data inicial" value={from} max={today ?? undefined} onChange={(event) => setFrom(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg bg-bg-white-0 px-2 text-paragraph-xs text-text-strong-950 outline-none ring-1 ring-inset ring-stroke-soft-200 focus:ring-primary-base" />
            <span className="text-text-soft-400" aria-hidden="true">–</span>
            <input type="date" aria-label="Data final" value={to} max={today ?? undefined} onChange={(event) => setTo(event.target.value)} className="h-8 min-w-0 flex-1 rounded-lg bg-bg-white-0 px-2 text-paragraph-xs text-text-strong-950 outline-none ring-1 ring-inset ring-stroke-soft-200 focus:ring-primary-base" />
          </div>
          {customError && <p role="alert" className="mt-2 text-paragraph-xs text-error-base">{customError}</p>}
          <button type="button" disabled={!from || !to || Boolean(customError)} onClick={() => { onChange({ kind: "custom", from, to }); setOpen(false); }} className="mt-3 h-8 w-full rounded-lg bg-bg-strong-950 text-label-xs text-text-white-0 outline-none transition hover:bg-bg-surface-800 focus-visible:ring-2 focus-visible:ring-primary-base disabled:cursor-not-allowed disabled:bg-bg-weak-50 disabled:text-text-disabled-300">
            Aplicar período
          </button>
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
