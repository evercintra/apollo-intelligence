"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QualificationDebugTrace } from "@/lib/qualification";
import { translateQualificationReason } from "@/lib/prospectingLabels";

interface CampaignInfo {
  id: string;
  name: string;
  status: string;
  targetMode: string;
  targetLeadCount: number;
  targetDomainCount: number | null;
  accumulatedLeadCount: number;
  apolloLink: string | null;
  inputMode: string;
}

interface DomainRow {
  id: string | null;
  domain: string;
  status: string;
  isParentCompany: boolean;
  checkedAt: string | null;
  allLeadCount: number | null;
  verifiedEmployeeCount: number | null;
  revenue: string | null;
  parentId: string | null;
  parentPending: boolean;
  parentDomain: string | null;
  parentPreviouslyAdded: boolean;
  parentCampaignId: string | null;
  reason: string | null;
  qualificationDebug: QualificationDebugTrace | null;
}

interface ActiveJobInfo {
  id: string;
  status: string;
  currentDomain: string | null;
}

interface LiveStats {
  accumulated: number;
  qualified: number;
  processed: number;
  campaignStatus: string;
  jobStatus?: string | null;
  currentDomain?: string | null;
}

const STATUS_TONE: Record<string, string> = {
  qualified: "bg-[var(--color-success-lighter)] text-[var(--color-success-dark)]",
  apollo_no_data: "bg-[var(--color-warning-lighter)] text-[var(--color-warning-dark)]",
  apollo_has_data: "bg-[var(--color-complement-surface)] text-[var(--color-complement-deep)]",
  not_live: "bg-[var(--color-error-lighter)] text-[var(--color-error-dark)]",
  no_ads: "bg-bg-weak-50 text-text-strong-950/60",
  pending: "bg-bg-weak-50 text-text-strong-950/50",
};

const STATUS_LABELS: Record<string, string> = {
  qualified: "Qualificado",
  apollo_no_data: "Sem dados na Apollo",
  apollo_has_data: "Com dados na Apollo",
  not_live: "Inativo",
  no_ads: "Sem anúncios",
  pending: "Pendente",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[10px] px-2 py-0.5 rounded font-medium uppercase tracking-wide ${
        STATUS_TONE[status] ?? "bg-bg-weak-50 text-text-strong-950/60"
      }`}
    >
      {STATUS_LABELS[status] ?? status.replace(/_/g, " ")}
    </span>
  );
}

function sortDomainRows(rows: DomainRow[]) {
  return [...rows].sort((a, b) => {
    const aTime = a.checkedAt ? new Date(a.checkedAt).getTime() : 0;
    const bTime = b.checkedAt ? new Date(b.checkedAt).getTime() : 0;
    return bTime - aTime;
  });
}

function formatRevenue(value: string | null) {
  if (value === null) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `US$ ${Math.round(n).toLocaleString("pt-BR")}`;
}

function formatTimestamp(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

function ParentCell({ domain, campaignId }: { domain: DomainRow; campaignId: string }) {
  if (domain.parentDomain) {
    const previouslyAdded =
      domain.parentPreviouslyAdded ||
      Boolean(domain.parentCampaignId && domain.parentCampaignId !== campaignId);

    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-text-strong-950/70">{domain.parentDomain}</span>
        {previouslyAdded && domain.parentCampaignId ? (
          <Link
            href={`/campaigns/${domain.parentCampaignId}`}
            onClick={(event) => event.stopPropagation()}
            className="text-[10px] font-medium text-[var(--color-complement-deep)] hover:underline"
          >
            (adicionado anteriormente)
          </Link>
        ) : previouslyAdded ? (
          <span className="text-[10px] text-text-strong-950/40">(adicionado anteriormente)</span>
        ) : null}
      </span>
    );
  }
  if (domain.parentPending) {
    return <span className="text-[var(--color-warning-dark)]">Requer pesquisa manual</span>;
  }
  return <span className="text-text-strong-950/35">Nenhuma empresa pai encontrada</span>;
}

function Stat({ label, value, pulse }: { label: string; value: string; pulse?: boolean }) {
  return (
    <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3">
      <p className="text-[10px] text-text-strong-950/40 uppercase tracking-widest">{label}</p>
      <p className={`text-lg font-bold text-text-strong-950 mt-0.5 font-mono ${pulse ? "animate-pulse" : ""}`}>
        {value}
      </p>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-80 overflow-auto rounded-lg bg-[var(--color-apollo-graphite-950)] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-apollo-soft-white)]">
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  );
}

function DebugSidePanel({
  domain,
  onClose,
}: {
  domain: DomainRow;
  onClose: () => void;
}) {
  const debug = domain.qualificationDebug;
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-stroke-soft-200 bg-bg-white-0 shadow-2xl">
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-stroke-soft-200 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold text-text-strong-950 truncate">{domain.domain}</p>
            <p className="mt-1 text-xs text-text-strong-950/45">
              {domain.reason ? translateQualificationReason(domain.reason) : "Nenhum motivo salvo"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 shrink-0 rounded-lg border border-stroke-soft-200 text-text-strong-950/50 hover:bg-bg-weak-50"
            aria-label="Fechar painel de depuração"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!debug ? (
            <p className="text-sm text-text-strong-950/45">Ainda não há rastro de depuração salvo para esta linha.</p>
          ) : (
            <div className="flex flex-col gap-5">
              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  Busca da empresa pai com IA
                </h2>
                <JsonBlock value={debug.parentLookup ?? null} />
              </section>

              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  Busca da empresa filha na Apollo
                </h2>
                <JsonBlock value={debug.apollo?.child ?? null} />
              </section>

              <section>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-strong-950/45">
                  Busca da empresa pai na Apollo
                </h2>
                <JsonBlock value={debug.apollo?.parent ?? null} />
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailClient({
  campaign,
  activeJob,
  domains: initialDomains,
}: {
  campaign: CampaignInfo;
  activeJob: ActiveJobInfo | null;
  domains: DomainRow[];
}) {
  const [running, setRunning] = useState(Boolean(activeJob));
  const [stopping, setStopping] = useState(false);
  const [limit, setLimit] = useState("200");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live state — updated by SSE events while the job runs.
  const [domains, setDomains] = useState<DomainRow[]>(() => sortDomainRows(initialDomains));
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);
  const [apolloLink, setApolloLink] = useState<string | null>(campaign.apolloLink);
  const [currentDomain, setCurrentDomain] = useState<string | null>(activeJob?.currentDomain ?? null);
  const [selectedDomain, setSelectedDomain] = useState<DomainRow | null>(null);

  const esRef = useRef<EventSource | null>(null);

  // Derived display values: prefer live stats when running, fall back to props.
  const displayAccumulated = liveStats?.accumulated ?? campaign.accumulatedLeadCount;
  const displayStatus = liveStats?.campaignStatus ?? campaign.status;
  const displayQualified = liveStats?.qualified ?? domains.filter((d) => d.status === "qualified").length;
  const displayProcessed = liveStats?.processed ?? domains.length;
  // "domains" mode target is a fixed batch size (top N candidates to analyze),
  // not a qualified-count goal — so its progress is processed-so-far / N,
  // excluding incidentally-discovered parent companies from the candidate count.
  const displayTargetedDomainsProcessed = domains.filter((d) => !d.isParentCompany).length;

  const [exporting, setExporting] = useState(false);

  async function exportCsv() {
    setExporting(true);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/export`);
      if (!res.ok) throw new Error("Falha na exportação");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "campaign.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      setError("Falha na exportação. Tente novamente.");
    } finally {
      setExporting(false);
    }
  }

  const pendingParents = domains.filter((d) => d.parentPending && !d.parentDomain);

  const openStream = useCallback(() => {
    esRef.current?.close();
    setError(null);
    setNotice(null);
    setRunning(true);

    const es = new EventSource(`/api/campaigns/${campaign.id}/stream`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as {
          type: string;
          data: unknown;
        };

        if (event.type === "domain") {
          const row = event.data as DomainRow;
          setDomains((prev) => {
            const idx = prev.findIndex((d) => d.domain === row.domain);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = row;
              return sortDomainRows(next);
            }
            return sortDomainRows([row, ...prev]);
          });
        } else if (event.type === "stats") {
          const stats = event.data as LiveStats;
          setLiveStats(stats);
          setCurrentDomain(stats.currentDomain ?? null);
        } else if (event.type === "all_domains") {
          // Final snapshot including parent rows — replace the full list.
          setDomains(sortDomainRows(event.data as DomainRow[]));
        } else if (event.type === "done") {
          const { apolloLink: link, stopped, failed } = event.data as {
            apolloLink: string | null;
            stopped?: boolean;
            failed?: boolean;
          };
          if (link) setApolloLink(link);
          if (stopped) setNotice("Tarefa interrompida. O progresso dos domínios concluídos foi salvo.");
          if (failed) setError("A tarefa falhou. O progresso dos domínios concluídos foi salvo.");
          setRunning(false);
          setStopping(false);
          setCurrentDomain(null);
          es.close();
          esRef.current = null;
        } else if (event.type === "error") {
          const { message } = event.data as { message: string };
          setError(message);
          setRunning(false);
          setStopping(false);
          setCurrentDomain(null);
          es.close();
          esRef.current = null;
        }
      } catch {
        // Malformed event — ignore.
      }
    };

    es.onerror = () => {
      setError("Conexão perdida. A tarefa pode ainda estar em execução — atualize para verificar.");
      setRunning(false);
      setStopping(false);
      setCurrentDomain(null);
      es.close();
      esRef.current = null;
    };
  }, [campaign.id]);

  useEffect(() => {
    if (!activeJob || esRef.current) return;
    openStream();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [activeJob, openStream]);

  async function startStream() {
    setError(null);
    setNotice(null);
    setRunning(true);
    setStopping(false);
    setCurrentDomain(null);

    const res = await fetch(`/api/campaigns/${campaign.id}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: Number(limit) || 100 }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Não foi possível iniciar a tarefa.");
      setRunning(false);
      return;
    }

    openStream();
  }

  async function stopStream() {
    if (!running || stopping) return;
    setStopping(true);
    setError(null);
    setNotice(null);

    const res = await fetch(`/api/campaigns/${campaign.id}/stop`, { method: "POST" });
    if (!res.ok) {
      setStopping(false);
      setError("Não foi possível interromper a tarefa. Tente novamente.");
    }
  }

  async function setParent(childDomain: string, parentDomain: string) {
    if (!parentDomain.trim()) return;
    const res = await fetch(
      `/api/targeted-domains/${encodeURIComponent(childDomain)}/parent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentDomain: parentDomain.trim() }),
      },
    );
    if (res.ok) {
      setDomains((prev) =>
        prev.map((d) =>
          d.domain === childDomain
            ? { ...d, parentDomain: parentDomain.trim(), parentPending: false }
            : d,
        ),
      );
    }
  }

  function copyLink() {
    if (!apolloLink) return;
    navigator.clipboard.writeText(apolloLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5 max-w-5xl">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Status" value={STATUS_LABELS[displayStatus] ?? displayStatus} pulse={running} />
        {campaign.targetMode === "domains" ? (
          <Stat
            label="Domínios analisados"
            value={`${displayTargetedDomainsProcessed.toLocaleString()} / ${(campaign.targetDomainCount ?? 0).toLocaleString()}`}
            pulse={running}
          />
        ) : (
          <Stat
            label="Leads"
            value={`${displayAccumulated.toLocaleString()} / ${campaign.targetLeadCount.toLocaleString()}`}
            pulse={running}
          />
        )}
        <Stat label="Qualificados" value={String(displayQualified)} pulse={running} />
        <Stat label="Processados" value={String(displayProcessed)} pulse={running} />
      </div>

      {/* Run controls */}
      <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        {campaign.targetMode === "domains" ? (
          <span className="text-sm text-text-strong-950/60">
            Analisa os {(campaign.targetDomainCount ?? 0).toLocaleString()} principais domínios candidatos
          </span>
        ) : (
          <>
            <span className="text-sm text-text-strong-950/60">Processar até</span>
            <input
              type="number"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={running}
              className="h-9 w-24 rounded-lg border border-stroke-soft-200 px-3 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-[var(--color-action-ring)] disabled:opacity-50"
            />
            <span className="text-sm text-text-strong-950/60">candidatos</span>
          </>
        )}

        {running && currentDomain && (
          <span className="text-xs text-text-strong-950/40 font-mono truncate max-w-xs">
            ↳ {currentDomain}
          </span>
        )}

        <button
          onClick={exportCsv}
          disabled={exporting || domains.length === 0}
          className="ml-auto h-9 px-4 border border-stroke-soft-200 text-text-strong-950/70 text-sm font-semibold rounded-lg hover:bg-bg-weak-50 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exporting ? "Exportando…" : "Exportar CSV"}
        </button>

        <button
          onClick={startStream}
          disabled={running}
          className="flex h-9 items-center gap-2 rounded-lg bg-[var(--color-action-bg)] px-4 text-sm font-semibold text-[var(--color-action-text)] transition-colors hover:bg-[var(--color-action-bg-hover)] disabled:opacity-60"
        >
          {running && (
            <div className="size-4 animate-spin rounded-full border-2 border-[var(--color-action-text)]/40 border-t-[var(--color-action-text)]" />
          )}
          {running ? "Em execução…" : "Executar qualificação"}
        </button>
        {running && (
          <button
            onClick={stopStream}
            disabled={stopping}
            className="h-9 rounded-lg border border-[var(--color-error-light)] bg-[var(--color-error-lighter)] px-4 text-sm font-semibold text-[var(--color-error-dark)] transition-colors hover:bg-[var(--color-error-light)] disabled:opacity-60"
          >
            {stopping ? "Interrompendo…" : "Interromper tarefa"}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-[var(--color-error-dark)]">{error}</p>}
      {notice && <p className="text-xs text-text-strong-950/50">{notice}</p>}

      {/* Apollo link */}
      {apolloLink && (
        <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl px-4 py-3">
          <p className="text-[10px] text-text-strong-950/40 uppercase tracking-widest mb-1.5">
            Link da Apollo (domínios qualificados)
          </p>
          <div className="flex items-center gap-2">
            <a
              href={apolloLink}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-[var(--color-complement-deep)] hover:underline"
            >
              {apolloLink}
            </a>
            <button
              onClick={copyLink}
              className="shrink-0 h-8 px-3 text-xs font-medium text-text-strong-950/70 border border-stroke-soft-200 rounded-lg hover:bg-bg-weak-50"
            >
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>
      )}

      {/* Parent research queue */}
      {pendingParents.length > 0 && (
        <div className="rounded-xl border border-[var(--color-warning-light)] bg-[var(--color-warning-lighter)] px-4 py-3">
          <p className="mb-2 text-sm font-semibold text-[var(--color-warning-dark)]">
            Pesquisa de empresa pai necessária ({pendingParents.length})
          </p>
          <div className="flex flex-col gap-2">
            {pendingParents.map((d) => (
              <ParentResearchRow key={d.domain} domain={d.domain} onSubmit={setParent} />
            ))}
          </div>
        </div>
      )}

      {/* Domains table */}
      <div className="bg-bg-white-0 border border-stroke-soft-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-weak-50 text-left text-[10px] text-text-strong-950/50 uppercase tracking-widest">
              <th className="px-4 py-2.5 font-semibold">Domínio</th>
              <th className="px-4 py-2.5 font-semibold">Data/hora</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold">Empresa pai</th>
              <th className="px-4 py-2.5 font-semibold">Faturamento (US$)</th>
              <th className="px-4 py-2.5 font-semibold">Todos os leads</th>
              <th className="px-4 py-2.5 font-semibold">Verificados</th>
              <th className="px-4 py-2.5 font-semibold">Pai</th>
              <th className="px-4 py-2.5 font-semibold">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {domains.length === 0 && !running ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-text-strong-950/40">
                  Nenhum domínio processado ainda. Execute a qualificação acima.
                </td>
              </tr>
            ) : domains.length === 0 && running ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-text-strong-950/40 text-sm">
                  <div className="flex items-center justify-center gap-2">
                    <div className="size-3 animate-spin rounded-full border-2 border-stroke-sub-300 border-t-[var(--color-action-ring)]" />
                    Processando…
                  </div>
                </td>
              </tr>
            ) : (
              domains.map((d) => (
                <tr
                  key={d.domain}
                  onClick={() => setSelectedDomain(d)}
                  className={`border-t border-stroke-soft-200 transition-colors ${
                      currentDomain === d.domain ? "bg-[var(--color-accent-soft)]" : ""
                  } cursor-pointer hover:bg-bg-weak-50`}
                >
                  <td className="px-4 py-2.5 text-text-strong-950 font-medium font-mono text-xs">
                    {d.domain}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-strong-950/50">
                    {formatTimestamp(d.checkedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-text-strong-950/60">
                    {d.isParentCompany ? "Sim" : "Não"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {formatRevenue(d.revenue)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {d.allLeadCount ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-text-strong-950/70">
                    {d.verifiedEmployeeCount ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    <ParentCell domain={d} campaignId={campaign.id} />
                  </td>
                  <td className="px-4 py-2.5 text-text-strong-950/50 text-xs">
                    {d.reason ? translateQualificationReason(d.reason) : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedDomain && (
        <DebugSidePanel domain={selectedDomain} onClose={() => setSelectedDomain(null)} />
      )}
    </div>
  );
}

function ParentResearchRow({
  domain,
  onSubmit,
}: {
  domain: string;
  onSubmit: (child: string, parent: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-text-strong-950/70 w-48 truncate">{domain}</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="dominio-pai.com"
        className="h-9 flex-1 rounded-lg border border-[var(--color-warning-light)] bg-bg-white-0 px-3 text-sm text-text-strong-950 focus:outline-none focus:ring-2 focus:ring-[var(--color-warning-base)]"
      />
      <button
        onClick={() => onSubmit(domain, value)}
        className="h-9 rounded-lg bg-[var(--color-action-bg)] px-3 text-xs font-medium text-[var(--color-action-text)] hover:bg-[var(--color-action-bg-hover)]"
      >
        Definir pai
      </button>
    </div>
  );
}
