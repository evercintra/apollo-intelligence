"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import DeleteCampaignButton from "./DeleteCampaignButton";

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  inputMode: string;
  targetMode: string;
  targetDomainCount: number | null;
  targetLeadCount: number;
  jobTitles: string[] | null;
  accumulatedLeadCount: number;
}

const STATUS_LABELS: Record<string, string> = {
  ready: "Pronto",
  done: "Concluído",
  failed: "Falhou",
  running: "Em execução",
  stopped: "Interrompido",
};

const INPUT_MODE_LABELS: Record<string, string> = {
  filters: "Filtros",
  manual: "Lista manual",
};

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready"
      ? "bg-[var(--color-success-lighter)] text-[var(--color-success-dark)]"
      : status === "done"
      ? "bg-bg-weak-50 text-text-strong-950/60"
      : "bg-[var(--color-complement-surface)] text-[var(--color-complement-deep)]";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide ${tone}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export default function CampaignListClient({ campaigns }: { campaigns: CampaignRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allSelected = campaigns.length > 0 && selected.size === campaigns.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(campaigns.map((c) => c.id)));
  }

  const downloadHref = useMemo(() => {
    if (selected.size === 0) return null;
    return `/api/campaigns/export?ids=${[...selected].join(",")}`;
  }, [selected]);

  if (campaigns.length === 0) {
    return (
      <div className="text-sm text-text-strong-950/50 border border-dashed border-stroke-soft-200 rounded-xl px-6 py-12 text-center">
        Nenhuma campanha ainda. Crie uma à esquerda para começar.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-text-strong-950/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-stroke-sub-300"
          />
          Selecionar todos
        </label>

        {selected.size > 0 && (
          <>
            <span className="text-xs text-text-strong-950/40">{selected.size} selecionados</span>
            <a
              href={downloadHref ?? undefined}
              className="ml-auto flex h-8 items-center rounded-lg bg-[var(--color-action-bg)] px-3 text-xs font-semibold text-[var(--color-action-text)] transition-colors hover:bg-[var(--color-action-bg-hover)]"
            >
              Baixar {selected.size} selecionados como CSV
            </a>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 transition-all hover:border-[var(--color-complement-ring)] hover:shadow-sm"
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              className="w-4 h-4 rounded border-stroke-sub-300 shrink-0"
            />
            <Link href={`/campaigns/${c.id}`} className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-strong-950 truncate">{c.name}</span>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-xs text-text-strong-950/50 mt-0.5">
                {INPUT_MODE_LABELS[c.inputMode] ?? c.inputMode} · alvo{" "}
                {c.targetMode === "domains"
                  ? `${(c.targetDomainCount ?? 0).toLocaleString()} domínios`
                  : `${c.targetLeadCount.toLocaleString()} leads`}
                {(c.jobTitles?.length ?? 0) > 0 && ` · ${c.jobTitles!.join(", ")}`}
              </p>
            </Link>
            <div className="text-right shrink-0">
              <p className="text-sm font-mono font-semibold text-text-strong-950">
                {c.accumulatedLeadCount.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-strong-950/40 uppercase tracking-wide">leads</p>
            </div>
            <DeleteCampaignButton campaignId={c.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
