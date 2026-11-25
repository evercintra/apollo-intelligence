"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiCheckboxCircleLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiDownloadLine,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiGroupLine,
  RiLinkM,
  RiLoader4Line,
  RiMoreLine,
  RiPlayLine,
  RiRefreshLine,
  RiSearchLine,
  RiUserLine,
  RiUserSearchLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as AlignButton from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Table from "@/components/alignui/table";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { LinkedInAccountTag } from "@/components/linkedin/LinkedInAccountTag";
import { useDialogs } from "@/components/DialogProvider";
import { SearchAccountPicker, type SearchPickerAccount } from "@/components/linkedin/SearchAccountPicker";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { PageTabs } from "@/components/page/PageTabs";
import { StatRow } from "@/components/page/StatRow";
import { cn } from "@/utils/cn";
import type { SearchBatchDetail } from "@/lib/linkedin/searchBatches";
import type { SearchQueryStatus } from "@/lib/linkedin/schema";

export type SearchAccount = SearchPickerAccount & { profilePictureUrl: string | null };

type BadgeColor = "gray" | "blue" | "orange" | "red" | "green" | "yellow" | "purple" | "sky" | "pink" | "teal";

const STATUS_META: Record<SearchQueryStatus, { label: string; color: BadgeColor }> = {
  QUEUED: { label: "Na fila", color: "gray" },
  RUNNING: { label: "Em execução", color: "blue" },
  PAUSED_LIMIT: { label: "Pausada — cota", color: "orange" },
  COMPLETED: { label: "Concluída", color: "green" },
  FAILED: { label: "Falhou", color: "red" },
  CANCELLED: { label: "Cancelada", color: "gray" },
};

/** The search's overall state, as on the list page. */
function rollupStatus(counts: Partial<Record<SearchQueryStatus, number>>): { label: string; color: BadgeColor } | null {
  if ((counts.RUNNING ?? 0) > 0) return STATUS_META.RUNNING;
  if ((counts.QUEUED ?? 0) > 0) return STATUS_META.QUEUED;
  if ((counts.PAUSED_LIMIT ?? 0) > 0) return STATUS_META.PAUSED_LIMIT;
  if ((counts.FAILED ?? 0) > 0) return STATUS_META.FAILED;
  if ((counts.COMPLETED ?? 0) > 0) return STATUS_META.COMPLETED;
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function networkLabel(d?: string | null) {
  if (!d) return "—";
  const n = d.replace("DISTANCE_", "");
  if (n === "1") return "1º";
  if (n === "2") return "2º";
  if (n === "3") return "3º";
  return n;
}

/** networkLabel for the table; the export keeps LinkedIn's raw value. */
function networkDisplay(d?: string | null) {
  const label = networkLabel(d);
  return label === "OUT_OF_NETWORK" ? "Fora da rede" : label;
}

function initials(name: string | null): string {
  const letters = (name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return letters || "?";
}

function slugify(name: string) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "search"
  );
}

/**
 * These URLs share a long, identical prefix (…/search/results/people/?origin=…), so a
 * plain truncation shows every row the same. Drop the origin and the noisy tracking
 * params and lead with what actually differs between two searches.
 */
function searchUrlLabel(raw: string): string {
  try {
    const u = new URL(raw);
    const params = new URLSearchParams(u.search);
    for (const key of ["origin", "sid", "trk", "trackingId"]) params.delete(key);
    const rest = params.toString();
    return rest ? `${u.pathname}?${decodeURIComponent(rest)}` : `${u.pathname}${u.search}`;
  } catch {
    return raw;
  }
}

function CopyUrlButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return; // Clipboard blocked (insecure context / denied) — leave the icon alone.
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Copiado" : "Copiar URL"}
      aria-label={copied ? "Copiado" : "Copiar URL"}
      className="shrink-0 rounded p-0.5 text-text-soft-400 outline-none transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base"
    >
      {copied ? <RiCheckLine className="size-3.5 text-success-base" /> : <RiFileCopyLine className="size-3.5" />}
    </button>
  );
}

/** Label + current value in one pill, opening a menu of choices. */
function FilterMenu({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-bg-white-0 px-2.5 text-paragraph-sm text-text-strong-950 shadow-regular-xs ring-1 ring-inset ring-stroke-soft-200 outline-none transition hover:bg-bg-weak-50 focus-visible:ring-2 focus-visible:ring-primary-base"
        >
          <span className="text-text-sub-600">{label}:</span>
          <span className="max-w-[10rem] truncate">{value}</span>
          <RiArrowDownSLine className="size-4 text-text-soft-400" aria-hidden="true" />
        </button>
      </Dropdown.Trigger>
      <Dropdown.Content align="start" className="max-h-80 overflow-y-auto">
        {children}
      </Dropdown.Content>
    </Dropdown.Root>
  );
}

/** "3 selected" + the bulk actions, across the top of a table panel. */
function SelectionBar({ count, note, onClear, children }: { count: number; note?: string; onClear: () => void; children: React.ReactNode }) {
  return (
    <div role="region" aria-label="Linhas selecionadas" className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-bg-weak-50 px-3 py-2 ring-1 ring-inset ring-stroke-soft-200">
      <span className="mr-1 text-label-sm tabular-nums text-text-strong-950">
        {count.toLocaleString("pt-BR")} selecionado{count === 1 ? "" : "s"}
        {note && <span className="ml-1 text-paragraph-xs text-text-sub-600">{note}</span>}
      </span>
      {children}
      <AlignButton.Root variant="neutral" mode="ghost" size="xxsmall" onClick={onClear} className="ml-auto">
        Limpar
      </AlignButton.Root>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-paragraph-sm text-text-sub-600">
      <RiErrorWarningLine className="mt-0.5 size-4 shrink-0 text-warning-base" aria-hidden="true" />
      {children}
    </p>
  );
}

const checkbox = "size-4 cursor-pointer rounded accent-primary-base disabled:cursor-not-allowed";
const num = "text-paragraph-sm tabular-nums text-text-strong-950";

const LEADS_PAGE_SIZE = 50;

const URL_SORTS = [
  { id: "added", label: "Data de adição" },
  { id: "leads-desc", label: "Mais leads" },
  { id: "leads-asc", label: "Menos leads" },
  { id: "company", label: "Empresa A–Z" },
] as const;

type UrlSort = (typeof URL_SORTS)[number]["id"];

const TABS = [
  { id: "urls", label: "URLs de busca" },
  { id: "leads", label: "Leads" },
] as const;

export function SearchBatchDetailClient({
  initialDetail,
  initialJobRunning,
  accounts,
}: {
  initialDetail: SearchBatchDetail;
  initialJobRunning: boolean;
  accounts: SearchAccount[];
}) {
  const dialogs = useDialogs();
  const router = useRouter();

  const [detail, setDetail] = useState(initialDetail);
  const [jobRunning, setJobRunning] = useState(initialJobRunning);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("urls");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* --------------------------------------------------------- Row selection */
  const [selectedQueryIds, setSelectedQueryIds] = useState<Set<string>>(new Set());
  const [selectedLeadUrls, setSelectedLeadUrls] = useState<Set<string>>(new Set());
  const [bulkExportingQueries, setBulkExportingQueries] = useState(false);
  const [bulkDeletingQueries, setBulkDeletingQueries] = useState(false);
  const [bulkExportingLeads, setBulkExportingLeads] = useState(false);
  const [bulkDeletingLeads, setBulkDeletingLeads] = useState(false);
  const [queryDeleteNotice, setQueryDeleteNotice] = useState<string | null>(null);
  const [rerunningQueries, setRerunningQueries] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}`);
    const data = await res.json();
    if (data.ok) {
      setDetail(data.detail);
      setJobRunning(data.jobRunning);
    }
  }, [detail.batch.id]);

  const hasActive = useMemo(
    () => detail.queries.some((q) => q.status === "QUEUED" || q.status === "RUNNING"),
    [detail.queries],
  );

  useEffect(() => {
    if (!hasActive) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      refresh();
    }, 3000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasActive, refresh]);

  const counts = useMemo(() => {
    const c: Partial<Record<SearchQueryStatus, number>> = {};
    for (const q of detail.queries) c[q.status] = (c[q.status] ?? 0) + 1;
    return c;
  }, [detail.queries]);

  const anyRunning = (counts.RUNNING ?? 0) > 0;
  const anyQueuedOrPaused = (counts.QUEUED ?? 0) > 0 || (counts.PAUSED_LIMIT ?? 0) > 0;
  const waitingOnAnotherJob = jobRunning && !anyRunning && anyQueuedOrPaused;

  /* ------------------------------------------------------------------ Run */
  const [runOpen, setRunOpen] = useState(false);
  // An ordered list, not a Set: the order here is the order the accounts get used in.
  const [runAccountOrder, setRunAccountOrder] = useState<string[]>([]);
  const runAccountIds = useMemo(() => new Set(runAccountOrder), [runAccountOrder]);
  const [running, setRunning] = useState(false);
  const [runNotice, setRunNotice] = useState<string | null>(null);

  const openRunDialog = () => {
    const connectedIds = new Set(accounts.map((a) => a.id));
    // The batch stores its accounts in the order the user arranged last time.
    const stored = detail.batch.accountIds.filter((id) => connectedIds.has(id));
    setRunAccountOrder(stored.length > 0 ? stored : accounts.map((a) => a.id));
    setRunNotice(null);
    setRunOpen(true);
  };

  const toggleRunAccount = (id: string) => {
    // Newly checked accounts join the end of the order.
    setRunAccountOrder((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // `queryIds` empty means the whole search; the Run dialog passes the ticked rows.
  const handleRun = async (queryIds: string[]) => {
    const ids = runAccountOrder;
    if (ids.length === 0) return;
    setRunOpen(false);
    setRunning(true);
    setRunNotice(null);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountIds: ids, ...(queryIds.length > 0 ? { queryIds } : {}) }),
      });
      const data = await res.json();
      if (!data.ok) {
        setRunNotice(typeof data.error === "string" ? data.error : "Não foi possível iniciar a execução");
        return;
      }
      if (data.started === false) {
        setRunNotice("Outra busca já está em execução — pressione Executar novamente quando ela terminar.");
      }
      setSelectedQueryIds(new Set());
      await refresh();
    } finally {
      setRunning(false);
    }
  };

  /* -------------------------------------------------------------- Add URLs */
  const [addOpen, setAddOpen] = useState(false);
  const [addUrlsText, setAddUrlsText] = useState("");
  const [addCompany, setAddCompany] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddUrls = async () => {
    const urls = addUrlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean)
      .map((url) => ({ url, companyName: addCompany.trim() || undefined }));
    if (urls.length === 0) {
      setAddError("Adicione pelo menos uma URL");
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}/queries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!data.ok) {
        setAddError(typeof data.error === "string" ? data.error : "Não foi possível adicionar as URLs");
        return;
      }
      setAddOpen(false);
      setAddUrlsText("");
      setAddCompany("");
      await refresh();
    } catch {
      setAddError("Erro de rede");
    } finally {
      setAdding(false);
    }
  };

  /* -------------------------------------------------------------- Delete */
  const handleDeleteBatch = async () => {
    const ok = await dialogs.confirm({
      title: "Excluir esta busca?",
      description: "As URLs e os leads encontrados serão excluídos permanentemente. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir busca",
      variant: "error",
    });
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        await dialogs.alert({
          title: "Não foi possível excluir a busca",
          description: typeof data.error === "string" ? data.error : "Algo deu errado. Tente novamente.",
          variant: "error",
        });
        return;
      }
      router.push("/linkedin/search");
    } finally {
      setDeleting(false);
    }
  };

  /* --------------------------------------------------------- Cancel a URL */
  const handleCancelQuery = async (id: string) => {
    setCancellingId(id);
    try {
      await fetch(`/api/linkedin/search/queue/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setCancellingId(null);
    }
  };

  /* --------------------------------------------------------------- Export */
  const handleExport = () => {
    if (detail.leads.length === 0) return;
    setExporting(true);
    try {
      const rows = detail.leads.map((r) => ({
        "Company Name": r.companyName ?? "",
        "LinkedIn URL": r.linkedinUrl,
        "Profile URL": r.profileUrl ?? "",
        "LinkedIn API": r.sourceLinkedinApi ?? "",
        Name: r.name ?? "",
        Headline: r.headline ?? "",
        Location: r.location ?? "",
        "Profile Picture URL": r.profilePictureUrl ?? "",
        "Invitation Message": "",
        "Acceptance Message": "",
        "Follow-up 1": "",
        "Follow-up 2": "",
        "Network Distance": networkLabel(r.networkDistance),
        Followers: r.followersCount ?? "",
        "Shared Connections": r.sharedConnectionsCount ?? "",
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 30 }, { wch: 45 }, { wch: 45 }, { wch: 18 }, { wch: 30 }, { wch: 50 }, { wch: 25 }, { wch: 55 },
        { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 14 }, { wch: 12 }, { wch: 20 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `${slugify(detail.batch.name)}-leads.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  /* ----------------------------------------------- Search URL tab filtering */
  const [urlSearch, setUrlSearch] = useState("");
  const [urlAccountId, setUrlAccountId] = useState<string | "all">("all");
  const [urlStatus, setUrlStatus] = useState<SearchQueryStatus | "all">("all");
  const [urlSort, setUrlSort] = useState<UrlSort>("added");

  // Only offer accounts that actually ran something in this batch — the full
  // connected list would mostly be dead options.
  const usedAccounts = useMemo(() => {
    const byId = new Map<string, { id: string; username: string; name: string | null }>();
    for (const q of detail.queries) if (q.currentAccount) byId.set(q.currentAccount.id, q.currentAccount);
    return [...byId.values()].sort((a, b) => a.username.localeCompare(b.username));
  }, [detail.queries]);

  const usedStatuses = useMemo(
    () => (Object.keys(counts) as SearchQueryStatus[]).sort(),
    [counts],
  );

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const visibleQueries = useMemo(() => {
    const term = urlSearch.trim().toLowerCase();
    const rows = detail.queries.filter((q) => {
      if (urlAccountId !== "all" && q.currentAccount?.id !== urlAccountId) return false;
      if (urlStatus !== "all" && q.status !== urlStatus) return false;
      if (!term) return true;
      return (q.companyName ?? "").toLowerCase().includes(term) || q.url.toLowerCase().includes(term);
    });
    const sorted = [...rows];
    if (urlSort === "leads-desc") sorted.sort((a, b) => b.leadsFetched - a.leadsFetched);
    else if (urlSort === "leads-asc") sorted.sort((a, b) => a.leadsFetched - b.leadsFetched);
    else if (urlSort === "company") sorted.sort((a, b) => (a.companyName ?? "").localeCompare(b.companyName ?? ""));
    return sorted;
  }, [detail.queries, urlSearch, urlAccountId, urlStatus, urlSort]);

  const urlFiltersActive = urlSearch.trim() !== "" || urlAccountId !== "all" || urlStatus !== "all";

  /* ------------------------------------------------ Search URL selection */
  // Intersecting with `visibleQueries` (rather than `detail.queries`) does double duty:
  // it prunes ids that no longer exist after a refresh, and it keeps every bulk action
  // scoped to what the current filters actually show — filter, then act on what you see.
  const selectedVisibleQueryIds = useMemo(() => {
    const visibleIds = new Set(visibleQueries.map((q) => q.id));
    const next = new Set<string>();
    for (const id of selectedQueryIds) if (visibleIds.has(id)) next.add(id);
    return next;
  }, [selectedQueryIds, visibleQueries]);

  const allVisibleQueriesSelected = visibleQueries.length > 0 && selectedVisibleQueryIds.size === visibleQueries.length;
  const someVisibleQueriesSelected = selectedVisibleQueryIds.size > 0 && !allVisibleQueriesSelected;

  const urlHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (urlHeaderCheckboxRef.current) urlHeaderCheckboxRef.current.indeterminate = someVisibleQueriesSelected;
  }, [someVisibleQueriesSelected]);

  const toggleQuerySelection = (id: string) => {
    setSelectedQueryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisibleQueries = () => {
    setSelectedQueryIds((prev) => {
      const next = new Set(prev);
      for (const q of visibleQueries) {
        if (allVisibleQueriesSelected) next.delete(q.id);
        else next.add(q.id);
      }
      return next;
    });
  };

  const clearQuerySelection = () => setSelectedQueryIds(new Set());

  const handleExportSelectedQueries = () => {
    const rows = detail.queries.filter((q) => selectedVisibleQueryIds.has(q.id));
    if (rows.length === 0) return;
    setBulkExportingQueries(true);
    try {
      const data = rows.map((q) => ({
        "Company Name": q.companyName ?? "",
        "Search URL": q.url,
        Status: STATUS_META[q.status].label,
        Account: q.currentAccount ? `@${q.currentAccount.username}` : "",
        "Leads Fetched": q.leadsFetched,
        "Total Count": q.totalCount ?? "",
        "Last Error": q.lastError ?? "",
        Created: formatDate(q.createdAt),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        { wch: 30 }, { wch: 55 }, { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 40 }, { wch: 20 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Search URLs");
      XLSX.writeFile(wb, `${slugify(detail.batch.name)}-search-urls.xlsx`);
    } finally {
      setBulkExportingQueries(false);
    }
  };

  const handleDeleteSelectedQueries = async () => {
    const ids = [...selectedVisibleQueryIds];
    if (ids.length === 0) return;
    const ok = await dialogs.confirm({
      title: `Excluir ${ids.length} ${ids.length === 1 ? "URL de busca" : "URLs de busca"}?`,
      description:
        "Os leads encontrados por estas URLs também serão excluídos. Uma URL ainda em execução será cancelada em vez de excluída. Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "error",
    });
    if (!ok) return;
    setBulkDeletingQueries(true);
    setQueryDeleteNotice(null);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}/queries`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        await dialogs.alert({
          title: "Não foi possível excluir as URLs de busca",
          description: typeof data.error === "string" ? data.error : "Algo deu errado. Tente novamente.",
          variant: "error",
        });
        return;
      }
      setSelectedQueryIds(new Set());
      if (typeof data.cancelled === "number" && data.cancelled > 0) {
        setQueryDeleteNotice(`${data.cancelled} ${data.cancelled === 1 ? "URL foi cancelada porque ainda estava" : "URLs foram canceladas porque ainda estavam"} em execução.`);
      }
      await refresh();
    } finally {
      setBulkDeletingQueries(false);
    }
  };

  // How many ticked rows Run would actually act on — a COMPLETED row needs Re-run, not Run.
  const runnableSelectedCount = detail.queries.filter(
    (q) => selectedVisibleQueryIds.has(q.id) && (q.status === "QUEUED" || q.status === "PAUSED_LIMIT")
  ).length;

  const runDisabled =
    anyRunning || (selectedVisibleQueryIds.size > 0 ? runnableSelectedCount === 0 : !anyQueuedOrPaused);

  const handleRerunSelectedQueries = async () => {
    const ids = [...selectedVisibleQueryIds];
    if (ids.length === 0) return;
    const ok = await dialogs.confirm({
      title: `Executar novamente ${ids.length} ${ids.length === 1 ? "URL de busca" : "URLs de busca"}?`,
      description:
        "Os leads já encontrados por estas URLs são excluídos primeiro e as buscas são refeitas do zero. Uma URL ainda em execução permanece como está.",
      confirmLabel: "Excluir leads e executar novamente",
      variant: "error",
    });
    if (!ok) return;
    setRerunningQueries(true);
    setQueryDeleteNotice(null);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}/queries/rerun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Same accounts the batch already remembers, in their saved order.
        body: JSON.stringify({ ids }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        await dialogs.alert({
          title: "Não foi possível executar estas URLs novamente",
          description: typeof data.error === "string" ? data.error : "Algo deu errado. Tente novamente.",
          variant: "error",
        });
        return;
      }
      setSelectedQueryIds(new Set());
      const notes: string[] = [];
      if (data.reset > 0) {
        notes.push(
          `${data.reset} ${data.reset === 1 ? "URL voltou" : "URLs voltaram"} para a fila (${data.leadsDeleted.toLocaleString("pt-BR")} ${data.leadsDeleted === 1 ? "lead removido" : "leads removidos"}).`
        );
      }
      if (data.skipped > 0) {
        notes.push(`${data.skipped} ${data.skipped === 1 ? "foi mantida porque ainda está" : "foram mantidas porque ainda estão"} em execução.`);
      }
      if (data.started === false && data.reason === "already_running") {
        notes.push("Outra busca está em execução — pressione Executar quando ela terminar.");
      }
      setQueryDeleteNotice(notes.join(" ") || null);
      await refresh();
    } finally {
      setRerunningQueries(false);
    }
  };

  /* ------------------------------------------------- Leads tab filtering */
  const [leadSearch, setLeadSearch] = useState("");

  const visibleLeads = useMemo(() => {
    const term = leadSearch.trim().toLowerCase();
    if (!term) return detail.leads;
    return detail.leads.filter(
      (l) =>
        (l.name ?? "").toLowerCase().includes(term) ||
        (l.headline ?? "").toLowerCase().includes(term) ||
        (l.companyName ?? "").toLowerCase().includes(term) ||
        (l.location ?? "").toLowerCase().includes(term),
    );
  }, [detail.leads, leadSearch]);

  /* -------------------------------------------------------- Lead selection */
  // Scoped to `visibleLeads` (all pages, post-filter) rather than `pageLeads`, so the
  // header checkbox and bulk actions cover everything the filter currently matches —
  // not just the page in view. Same intersection also drops ids pruned by a refresh.
  const selectedVisibleLeadUrls = useMemo(() => {
    const visibleUrls = new Set(visibleLeads.map((l) => l.linkedinUrl));
    const next = new Set<string>();
    for (const url of selectedLeadUrls) if (visibleUrls.has(url)) next.add(url);
    return next;
  }, [selectedLeadUrls, visibleLeads]);

  const allVisibleLeadsSelected = visibleLeads.length > 0 && selectedVisibleLeadUrls.size === visibleLeads.length;
  const someVisibleLeadsSelected = selectedVisibleLeadUrls.size > 0 && !allVisibleLeadsSelected;

  const leadHeaderCheckboxRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (leadHeaderCheckboxRef.current) leadHeaderCheckboxRef.current.indeterminate = someVisibleLeadsSelected;
  }, [someVisibleLeadsSelected]);

  const toggleLeadSelection = (linkedinUrl: string) => {
    setSelectedLeadUrls((prev) => {
      const next = new Set(prev);
      if (next.has(linkedinUrl)) next.delete(linkedinUrl);
      else next.add(linkedinUrl);
      return next;
    });
  };

  const toggleAllVisibleLeads = () => {
    setSelectedLeadUrls((prev) => {
      const next = new Set(prev);
      for (const l of visibleLeads) {
        if (allVisibleLeadsSelected) next.delete(l.linkedinUrl);
        else next.add(l.linkedinUrl);
      }
      return next;
    });
  };

  const clearLeadSelection = () => setSelectedLeadUrls(new Set());

  const handleExportSelectedLeads = () => {
    const rows = detail.leads.filter((l) => selectedVisibleLeadUrls.has(l.linkedinUrl));
    if (rows.length === 0) return;
    setBulkExportingLeads(true);
    try {
      const data = rows.map((r) => ({
        "Company Name": r.companyName ?? "",
        "LinkedIn URL": r.linkedinUrl,
        "Profile URL": r.profileUrl ?? "",
        "LinkedIn API": r.sourceLinkedinApi ?? "",
        Name: r.name ?? "",
        Headline: r.headline ?? "",
        Location: r.location ?? "",
        "Profile Picture URL": r.profilePictureUrl ?? "",
        "Invitation Message": "",
        "Acceptance Message": "",
        "Follow-up 1": "",
        "Follow-up 2": "",
        "Network Distance": networkLabel(r.networkDistance),
        Followers: r.followersCount ?? "",
        "Shared Connections": r.sharedConnectionsCount ?? "",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = [
        { wch: 30 }, { wch: 45 }, { wch: 45 }, { wch: 18 }, { wch: 30 }, { wch: 50 }, { wch: 25 }, { wch: 55 },
        { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 60 }, { wch: 14 }, { wch: 12 }, { wch: 20 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `${slugify(detail.batch.name)}-leads.xlsx`);
    } finally {
      setBulkExportingLeads(false);
    }
  };

  const handleDeleteSelectedLeads = async () => {
    const linkedinUrls = [...selectedVisibleLeadUrls];
    if (linkedinUrls.length === 0) return;
    const ok = await dialogs.confirm({
      title: `Excluir ${linkedinUrls.length} ${linkedinUrls.length === 1 ? "lead" : "leads"}?`,
      description: "Estes leads serão removidos desta busca. Ao executá-la novamente, eles podem ser encontrados de novo.",
      confirmLabel: "Excluir",
      variant: "error",
    });
    if (!ok) return;
    setBulkDeletingLeads(true);
    try {
      const res = await fetch(`/api/linkedin/search/batches/${detail.batch.id}/leads`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkedinUrls }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        await dialogs.alert({
          title: "Não foi possível excluir os leads",
          description: typeof data.error === "string" ? data.error : "Algo deu errado. Tente novamente.",
          variant: "error",
        });
        return;
      }
      setSelectedLeadUrls(new Set());
      await refresh();
    } finally {
      setBulkDeletingLeads(false);
    }
  };

  /* ------------------------------------------------------------ Pagination */
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(visibleLeads.length / LEADS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageLeads = useMemo(() => {
    const start = (safePage - 1) * LEADS_PAGE_SIZE;
    return visibleLeads.slice(start, start + LEADS_PAGE_SIZE);
  }, [visibleLeads, safePage]);
  const pageStart = visibleLeads.length === 0 ? 0 : (safePage - 1) * LEADS_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * LEADS_PAGE_SIZE, visibleLeads.length);

  const status = rollupStatus(counts);
  const doneCount = (counts.COMPLETED ?? 0) + (counts.FAILED ?? 0) + (counts.CANCELLED ?? 0);
  const leadsFound = detail.queries.reduce((sum, q) => sum + q.leadsFetched, 0);
  const pages = totalPages;

  return (
    <div className="mx-auto w-full max-w-[1440px]">
      <PageHeader
        back={{ href: "/linkedin/search", label: "Buscas" }}
        title={detail.batch.name}
        badge={
          status && (
            <Badge.Root size="medium" variant="lighter" color={status.color}>
              <Badge.Dot />
              {status.label}
            </Badge.Root>
          )
        }
        description={
          <span suppressHydrationWarning>
            {detail.batch.kind === "SINGLE" ? "URL de busca única" : "Planilha de URLs de busca"} · Criada em {formatDate(detail.batch.createdAt)}
          </span>
        }
        actions={
          <>
            <AlignButton.Root
              variant="primary"
              mode="filled"
              size="small"
              onClick={openRunDialog}
              disabled={running || runDisabled}
              title={selectedVisibleQueryIds.size > 0 ? "Executar as URLs selecionadas" : "Executar todas as URLs na fila desta busca"}
            >
              <AlignButton.Icon as={running ? RiLoader4Line : RiPlayLine} className={cn(running && "animate-spin")} />
              {selectedVisibleQueryIds.size > 0 ? `Executar selecionadas (${runnableSelectedCount})` : "Executar"}
            </AlignButton.Root>
            <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => setAddOpen(true)}>
              <AlignButton.Icon as={RiAddLine} />
              Adicionar URLs
            </AlignButton.Root>
            <AlignButton.Root
              variant="neutral"
              mode="stroke"
              size="small"
              onClick={handleExport}
              disabled={exporting || detail.leads.length === 0}
              title="Baixar todos os leads desta busca"
            >
              <AlignButton.Icon as={exporting ? RiLoader4Line : RiDownloadLine} className={cn(exporting && "animate-spin")} />
              Exportar leads
            </AlignButton.Root>
            <Dropdown.Root>
              <Dropdown.Trigger asChild>
                <AlignButton.Root variant="neutral" mode="stroke" size="small" disabled={deleting} aria-label="Mais ações para esta busca">
                  <AlignButton.Icon as={deleting ? RiLoader4Line : RiMoreLine} className={cn(deleting && "animate-spin")} />
                </AlignButton.Root>
              </Dropdown.Trigger>
              <Dropdown.Content align="end">
                <Dropdown.Item destructive onSelect={handleDeleteBatch} disabled={deleting}>
                  <Dropdown.ItemIcon as={RiDeleteBinLine} />
                  Excluir busca
                </Dropdown.Item>
              </Dropdown.Content>
            </Dropdown.Root>
          </>
        }
      />

      {(waitingOnAnotherJob || runNotice) && (
        <div className="mt-3 space-y-1">
          {waitingOnAnotherJob && <Notice>Outra busca está em execução — esta começará quando você pressionar Executar após o término.</Notice>}
          {runNotice && <Notice>{runNotice}</Notice>}
        </div>
      )}

      <StatRow
        className="mt-6"
        items={[
          { label: "URLs de busca", value: detail.queries.length.toLocaleString("pt-BR"), icon: RiLinkM },
          {
            label: "Pesquisadas",
            value: detail.queries.length === 0 ? "—" : `${doneCount.toLocaleString("pt-BR")} de ${detail.queries.length.toLocaleString("pt-BR")}`,
            icon: RiCheckboxCircleLine,
            hint: (counts.FAILED ?? 0) > 0 ? `${counts.FAILED} com falha` : undefined,
          },
          { label: "Leads encontrados", value: detail.leads.length.toLocaleString("pt-BR"), icon: RiUserSearchLine, hint: `${leadsFound.toLocaleString("pt-BR")} resultados antes da deduplicação` },
          { label: "Contas usadas", value: usedAccounts.length.toLocaleString("pt-BR"), icon: RiGroupLine },
        ]}
      />

      <PageTabs
        className="mt-6"
        label="Seções da busca"
        tabs={TABS.map((t) => ({ value: t.id, label: t.label, icon: t.id === "urls" ? RiLinkM : RiUserLine, count: t.id === "urls" ? detail.queries.length : detail.leads.length }))}
        value={tab}
        onChange={setTab}
      />

      {tab === "urls" && (
        <Frame className="mt-5">
          <FrameHeader
            title="URLs de busca"
            description={
              urlFiltersActive
                ? `${visibleQueries.length.toLocaleString("pt-BR")} de ${detail.queries.length.toLocaleString("pt-BR")} URLs correspondem aos filtros`
                : "Cada URL é pesquisada por uma conta; marque as linhas para executar, executar novamente, exportar ou excluir."
            }
            actions={detail.queries.length > 0 && (
              <>
                <Input.Root size="xsmall" className="w-full sm:w-64">
                  <Input.Wrapper>
                    <Input.Icon as={RiSearchLine} />
                    <Input.Input type="search" aria-label="Buscar empresa ou URL" placeholder="Buscar empresa ou URL…" value={urlSearch} onChange={(e) => setUrlSearch(e.target.value)} />
                  </Input.Wrapper>
                </Input.Root>
                <FilterMenu
                  label="Conta"
                  value={urlAccountId === "all" ? "Todas" : `@${usedAccounts.find((a) => a.id === urlAccountId)?.username ?? "desconhecida"}`}
                >
                  <Dropdown.Item onSelect={() => setUrlAccountId("all")}>Todas as contas</Dropdown.Item>
                  {usedAccounts.map((a) => (
                    <Dropdown.Item key={a.id} onSelect={() => setUrlAccountId(a.id)}>
                      <LinkedInAccountTag account={{ username: a.username, name: a.name, profilePictureUrl: accountById.get(a.id)?.profilePictureUrl ?? null }} />
                    </Dropdown.Item>
                  ))}
                </FilterMenu>
                <FilterMenu label="Status" value={urlStatus === "all" ? "Todos" : STATUS_META[urlStatus].label}>
                  <Dropdown.Item onSelect={() => setUrlStatus("all")}>Todos os statuses</Dropdown.Item>
                  {usedStatuses.map((st) => (
                    <Dropdown.Item key={st} onSelect={() => setUrlStatus(st)}>
                      {STATUS_META[st].label}
                      <span className="ml-auto pl-3 tabular-nums text-text-soft-400">{counts[st]}</span>
                    </Dropdown.Item>
                  ))}
                </FilterMenu>
                <FilterMenu label="Ordenar" value={URL_SORTS.find((o) => o.id === urlSort)?.label ?? "Data de adição"}>
                  {URL_SORTS.map((o) => (
                    <Dropdown.Item key={o.id} onSelect={() => setUrlSort(o.id)}>
                      {o.label}
                    </Dropdown.Item>
                  ))}
                </FilterMenu>
                {urlFiltersActive && (
                  <AlignButton.Root
                    variant="neutral"
                    mode="ghost"
                    size="xxsmall"
                    onClick={() => {
                      setUrlSearch("");
                      setUrlAccountId("all");
                      setUrlStatus("all");
                    }}
                  >
                    Limpar filtros
                  </AlignButton.Root>
                )}
              </>
            )}
          />
          <FramePanel className="p-2 sm:p-2">
            {queryDeleteNotice && (
              <div className="mb-2 px-2 pt-1">
                <Notice>{queryDeleteNotice}</Notice>
              </div>
            )}
            {selectedVisibleQueryIds.size > 0 && (
              <SelectionBar count={selectedVisibleQueryIds.size} onClear={clearQuerySelection}>
                <AlignButton.Root variant="neutral" mode="stroke" size="xxsmall" onClick={handleExportSelectedQueries} disabled={bulkExportingQueries}>
                  <AlignButton.Icon as={bulkExportingQueries ? RiLoader4Line : RiDownloadLine} className={cn(bulkExportingQueries && "animate-spin")} />
                  Exportar
                </AlignButton.Root>
                <AlignButton.Root variant="neutral" mode="stroke" size="xxsmall" onClick={handleRerunSelectedQueries} disabled={rerunningQueries} title="Excluir os leads destas URLs e pesquisar novamente">
                  <AlignButton.Icon as={rerunningQueries ? RiLoader4Line : RiRefreshLine} className={cn(rerunningQueries && "animate-spin")} />
                  Executar novamente
                </AlignButton.Root>
                <AlignButton.Root variant="error" mode="stroke" size="xxsmall" onClick={handleDeleteSelectedQueries} disabled={bulkDeletingQueries}>
                  <AlignButton.Icon as={bulkDeletingQueries ? RiLoader4Line : RiDeleteBinLine} className={cn(bulkDeletingQueries && "animate-spin")} />
                  Excluir
                </AlignButton.Root>
              </SelectionBar>
            )}
            {visibleQueries.length === 0 ? (
              detail.queries.length === 0 ? (
                <EmptyState
                  icon={RiLinkM}
                  title="Nenhuma URL de busca ainda"
                  description="Adicione URLs de busca do LinkedIn a esta busca e execute-a."
                  action={
                    <AlignButton.Root variant="primary" mode="filled" size="small" onClick={() => setAddOpen(true)}>
                      <AlignButton.Icon as={RiAddLine} />
              Adicionar URLs
            </AlignButton.Root>
                  }
                />
              ) : (
                <EmptyState
                  icon={RiSearchLine}
                  title="Nenhuma URL corresponde a estes filtros"
                  description="Tente outra conta, status ou busca."
                  action={
                    <AlignButton.Root
                      variant="neutral"
                      mode="stroke"
                      size="small"
                      onClick={() => {
                        setUrlSearch("");
                        setUrlAccountId("all");
                        setUrlStatus("all");
                      }}
                    >
                      Limpar filtros
                    </AlignButton.Root>
                  }
                />
              )
            ) : (
              <Table.Root className="[&>table]:min-w-[860px]">
                <Table.Header>
                  <Table.Row>
                    <Table.Head scope="col" className="w-12 px-4">
                      <input
                        ref={urlHeaderCheckboxRef}
                        type="checkbox"
                        checked={allVisibleQueriesSelected}
                        onChange={toggleAllVisibleQueries}
                        className={checkbox}
                        aria-label="Selecionar todas as URLs de busca visíveis"
                      />
                    </Table.Head>
                    <Table.Head scope="col" className="px-4">Empresa e URL</Table.Head>
                    <Table.Head scope="col" className="w-60 px-4">Status</Table.Head>
                    <Table.Head scope="col" className="w-48 px-4">Conta</Table.Head>
                    <Table.Head scope="col" className="w-28 px-4 text-right">Leads</Table.Head>
                    <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Cancelar</span></Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body spacing={4}>
                  {visibleQueries.map((q) => {
                    const meta = STATUS_META[q.status];
                    const cancellable = q.status === "QUEUED" || q.status === "PAUSED_LIMIT" || q.status === "RUNNING";
                    const selected = selectedVisibleQueryIds.has(q.id);
                    return (
                      <Table.Row key={q.id} className={cn(selected && "[&>td]:bg-bg-weak-50")}>
                        <Table.Cell className="h-14 px-4">
                          <input type="checkbox" checked={selected} onChange={() => toggleQuerySelection(q.id)} className={checkbox} aria-label={`Selecionar ${q.companyName ?? q.url}`} />
                        </Table.Cell>
                        <Table.Cell className="max-w-0 px-4">
                          <p className="truncate text-label-sm text-text-strong-950" title={q.companyName ?? undefined}>
                            {q.companyName ?? <span className="text-text-soft-400">Sem empresa</span>}
                          </p>
                          <div className="mt-0.5 flex min-w-0 items-center gap-1">
                            <a href={q.url} target="_blank" rel="noreferrer" title={q.url} className="min-w-0 truncate font-mono text-paragraph-xs text-text-sub-600 hover:text-primary-base hover:underline">
                              {searchUrlLabel(q.url)}
                            </a>
                            <RiExternalLinkLine className="size-3 shrink-0 text-text-soft-400" aria-hidden="true" />
                            <CopyUrlButton url={q.url} />
                          </div>
                        </Table.Cell>
                        <Table.Cell className="max-w-0 px-4">
                          <Badge.Root size="medium" variant="lighter" color={meta.color}>
                            <Badge.Dot />
                            {meta.label}
                          </Badge.Root>
                          {q.lastError && (
                            <p className="mt-1 truncate text-paragraph-xs text-error-base" title={q.lastError}>
                              {q.lastError}
                            </p>
                          )}
                        </Table.Cell>
                        <Table.Cell className="max-w-0 px-4">
                          {q.currentAccount ? (
                            <LinkedInAccountTag
                              account={{
                                username: q.currentAccount.username,
                                name: q.currentAccount.name,
                                profilePictureUrl: accountById.get(q.currentAccount.id)?.profilePictureUrl ?? null,
                              }}
                            />
                          ) : (
                            <span className="text-paragraph-sm text-text-soft-400">—</span>
                          )}
                        </Table.Cell>
                        <Table.Cell className={cn("px-4 text-right", num)}>
                          {q.leadsFetched.toLocaleString("pt-BR")}
                          {q.totalCount ? <span className="text-text-soft-400"> / {q.totalCount.toLocaleString("pt-BR")}</span> : null}
                        </Table.Cell>
                        <Table.Cell className="px-4">
                          {cancellable && (
                            <div className="flex justify-end">
                              <AlignButton.Root
                                variant="neutral"
                                mode="ghost"
                                size="xxsmall"
                                onClick={() => handleCancelQuery(q.id)}
                                disabled={cancellingId === q.id}
                                title="Cancelar esta URL"
                                aria-label={`Cancelar ${q.companyName ?? "esta URL"}`}
                              >
                                <AlignButton.Icon as={cancellingId === q.id ? RiLoader4Line : RiCloseLine} className={cn(cancellingId === q.id && "animate-spin")} />
                              </AlignButton.Root>
                            </div>
                          )}
                        </Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            )}
          </FramePanel>
        </Frame>
      )}

      {tab === "leads" && (
        <Frame className="mt-5">
          <FrameHeader
            title="Leads"
            description={
              leadSearch.trim()
                ? `${visibleLeads.length.toLocaleString("pt-BR")} de ${detail.leads.length.toLocaleString("pt-BR")} leads correspondem à busca`
                : "Todos os leads encontrados por estas URLs, sem duplicatas. Marque as linhas para exportar ou excluir."
            }
            actions={
              detail.leads.length > 0 && (
                <Input.Root size="xsmall" className="w-44 sm:w-72">
                  <Input.Wrapper>
                    <Input.Icon as={RiSearchLine} />
                    <Input.Input
                      type="search"
                      aria-label="Buscar leads"
                      placeholder="Buscar nome, headline, empresa…"
                      value={leadSearch}
                      onChange={(e) => {
                        setLeadSearch(e.target.value);
                        setPage(1);
                      }}
                    />
                  </Input.Wrapper>
                </Input.Root>
              )
            }
          />
          <FramePanel className="p-2 sm:p-2">
            {selectedVisibleLeadUrls.size > 0 && (
              <SelectionBar count={selectedVisibleLeadUrls.size} note={pages > 1 ? "em todas as páginas deste filtro" : undefined} onClear={clearLeadSelection}>
                <AlignButton.Root variant="neutral" mode="stroke" size="xxsmall" onClick={handleExportSelectedLeads} disabled={bulkExportingLeads}>
                  <AlignButton.Icon as={bulkExportingLeads ? RiLoader4Line : RiDownloadLine} className={cn(bulkExportingLeads && "animate-spin")} />
                  Exportar
                </AlignButton.Root>
                <AlignButton.Root variant="error" mode="stroke" size="xxsmall" onClick={handleDeleteSelectedLeads} disabled={bulkDeletingLeads}>
                  <AlignButton.Icon as={bulkDeletingLeads ? RiLoader4Line : RiDeleteBinLine} className={cn(bulkDeletingLeads && "animate-spin")} />
                  Excluir
                </AlignButton.Root>
              </SelectionBar>
            )}
            {visibleLeads.length === 0 ? (
              detail.leads.length === 0 ? (
                <EmptyState icon={RiUserSearchLine} title="Nenhum lead ainda" description="Execute esta busca para extrair leads das suas URLs." />
              ) : (
                <EmptyState
                  icon={RiSearchLine}
                  title="Nenhum lead corresponde à busca"
                  description="Tente um nome, headline, empresa ou localização."
                  action={
                    <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => { setLeadSearch(""); setPage(1); }}>
                      Limpar busca
                    </AlignButton.Root>
                  }
                />
              )
            ) : (
              <Table.Root className="[&>table]:min-w-[900px] [&>table]:table-fixed">
                <Table.Header>
                  <Table.Row>
                    <Table.Head scope="col" className="w-12 px-4">
                      <input
                        ref={leadHeaderCheckboxRef}
                        type="checkbox"
                        checked={allVisibleLeadsSelected}
                        onChange={toggleAllVisibleLeads}
                        className={checkbox}
                        aria-label="Selecionar todos os leads que correspondem à busca"
                      />
                    </Table.Head>
                    <Table.Head scope="col" className="w-[34%] px-4">Lead</Table.Head>
                    <Table.Head scope="col" className="px-4">Empresa</Table.Head>
                    <Table.Head scope="col" className="px-4">Localização</Table.Head>
                    <Table.Head scope="col" className="w-24 px-4">Rede</Table.Head>
                    <Table.Head scope="col" className="w-28 px-4 text-right">Seguidores</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body spacing={4}>
                  {pageLeads.map((lead) => {
                    const selected = selectedVisibleLeadUrls.has(lead.linkedinUrl);
                    const name = lead.name ?? "Lead sem nome";
                    return (
                      <Table.Row key={lead.id} className={cn(selected && "[&>td]:bg-bg-weak-50")}>
                        <Table.Cell className="h-14 px-4">
                          <input type="checkbox" checked={selected} onChange={() => toggleLeadSelection(lead.linkedinUrl)} className={checkbox} aria-label={`Selecionar ${name}`} />
                        </Table.Cell>
                        <Table.Cell className="px-4">
                          <div className="flex min-w-0 items-center gap-3">
                            <ContactAvatar src={lead.profilePictureUrl} fallback={initials(lead.name)} className="size-9 bg-primary-alpha-10 text-label-xs text-primary-base" />
                            <div className="min-w-0">
                              {lead.profileUrl ? (
                                <a href={lead.profileUrl} target="_blank" rel="noreferrer" className="block truncate text-label-sm text-text-strong-950 hover:text-primary-base hover:underline" title={name}>
                                  {name}
                                </a>
                              ) : (
                                <p className="truncate text-label-sm text-text-strong-950" title={name}>{name}</p>
                              )}
                              <p className="truncate text-paragraph-xs text-text-sub-600" title={lead.headline ?? undefined}>{lead.headline ?? "Sem headline"}</p>
                            </div>
                          </div>
                        </Table.Cell>
                        <Table.Cell className="truncate px-4 text-paragraph-sm text-text-strong-950" title={lead.companyName ?? undefined}>
                          {lead.companyName ?? <span className="text-text-soft-400">—</span>}
                        </Table.Cell>
                        <Table.Cell className="truncate px-4 text-paragraph-sm text-text-sub-600" title={lead.location ?? undefined}>
                          {lead.location ?? <span className="text-text-soft-400">—</span>}
                        </Table.Cell>
                        <Table.Cell className="px-4 text-paragraph-sm text-text-sub-600">{networkDisplay(lead.networkDistance)}</Table.Cell>
                        <Table.Cell className={cn("px-4 text-right", num)}>{lead.followersCount != null ? lead.followersCount.toLocaleString("pt-BR") : <span className="text-text-soft-400">—</span>}</Table.Cell>
                      </Table.Row>
                    );
                  })}
                </Table.Body>
              </Table.Root>
            )}
          </FramePanel>
          {visibleLeads.length > 0 && (
            <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 pb-1 pt-2.5">
              <p className="text-paragraph-sm tabular-nums text-text-sub-600">
                {pageStart.toLocaleString("pt-BR")}–{pageEnd.toLocaleString("pt-BR")} de {visibleLeads.length.toLocaleString("pt-BR")}
              </p>
              {pages > 1 && (
                <div className="flex items-center gap-1">
                  <AlignButton.Root variant="neutral" mode="ghost" size="xsmall" aria-label="Página anterior" onClick={() => setPage(() => Math.max(1, safePage - 1))} disabled={safePage <= 1}>
                    <AlignButton.Icon as={RiArrowLeftSLine} />
                  </AlignButton.Root>
                  <span className="px-2 text-paragraph-sm tabular-nums text-text-sub-600">
                    Página {safePage} de {pages}
                  </span>
                  <AlignButton.Root variant="neutral" mode="ghost" size="xsmall" aria-label="Próxima página" onClick={() => setPage(() => Math.min(pages, safePage + 1))} disabled={safePage >= pages}>
                    <AlignButton.Icon as={RiArrowRightSLine} />
                  </AlignButton.Root>
                </div>
              )}
            </nav>
          )}
        </Frame>
      )}

      {/* Run dialog */}
      <Modal.Root open={runOpen} onOpenChange={setRunOpen}>
        <Modal.Content size="max-w-md">
          <Modal.Header icon={RiPlayLine}>
            <Modal.Title>Executar com quais contas?</Modal.Title>
            <Modal.Description>
              {selectedVisibleQueryIds.size > 0
                ? `Executando as ${runnableSelectedCount} ${runnableSelectedCount === 1 ? "URL selecionada que ainda está" : "URLs selecionadas que ainda estão"} na fila. `
                : "Executando todas as URLs na fila desta busca. "}
              Apenas as contas marcadas aqui serão usadas, na ordem em que você as organizar — a primeira é usada até
              atingir o limite diário, depois a próxima, e todas buscam em paralelo.
            </Modal.Description>
          </Modal.Header>
          <Modal.Body>
            <SearchAccountPicker
              accounts={accounts}
              selected={runAccountIds}
              onToggle={toggleRunAccount}
              mode="multi"
              order={runAccountOrder}
              onReorder={setRunAccountOrder}
              onSelectAll={() => setRunAccountOrder(accounts.map((a) => a.id))}
              onClear={() => setRunAccountOrder([])}
            />
          </Modal.Body>
          <Modal.Footer>
            <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => setRunOpen(false)}>
              Cancelar
            </AlignButton.Root>
            <AlignButton.Root variant="primary" mode="filled" size="small" onClick={() => handleRun([...selectedVisibleQueryIds])} disabled={runAccountIds.size === 0}>
              <AlignButton.Icon as={RiPlayLine} />
              Executar com {runAccountIds.size} {runAccountIds.size === 1 ? "conta" : "contas"}
            </AlignButton.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      {/* Add URLs dialog */}
      <Modal.Root open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) { setAddError(null); } }}>
        <Modal.Content size="max-w-lg">
          <Modal.Header icon={RiLinkM}>
            <Modal.Title>Adicionar URLs de busca</Modal.Title>
            <Modal.Description>Elas entram nesta busca na fila, prontas para a próxima execução.</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <div>
              <label htmlFor="add-urls" className="mb-1.5 block text-label-sm text-text-strong-950">URLs de busca, uma por linha</label>
              <Textarea.Root
                id="add-urls"
                simple
                value={addUrlsText}
                onChange={(e) => setAddUrlsText(e.target.value)}
                rows={5}
                placeholder={"https://www.linkedin.com/search/results/people/?keywords=...\nhttps://www.linkedin.com/search/results/people/?keywords=..."}
                className="font-mono text-paragraph-xs"
              />
            </div>
            <div>
              <label htmlFor="add-company" className="mb-1.5 block text-label-sm text-text-strong-950">Nome da empresa (opcional, aplica-se a todas as URLs acima)</label>
              <Input.Root size="small">
                <Input.Wrapper>
                  <Input.Input id="add-company" value={addCompany} onChange={(e) => setAddCompany(e.target.value)} />
                </Input.Wrapper>
              </Input.Root>
            </div>
            {addError && (
              <p role="alert" className="flex items-center gap-1.5 text-paragraph-sm text-error-base">
                <RiErrorWarningLine className="size-4 shrink-0" aria-hidden="true" />
                {addError}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <AlignButton.Root variant="neutral" mode="stroke" size="small" onClick={() => setAddOpen(false)}>
              Cancelar
            </AlignButton.Root>
            <AlignButton.Root variant="primary" mode="filled" size="small" onClick={handleAddUrls} disabled={adding}>
              <AlignButton.Icon as={adding ? RiLoader4Line : RiAddLine} className={cn(adding && "animate-spin")} />
              Adicionar URLs
            </AlignButton.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}
