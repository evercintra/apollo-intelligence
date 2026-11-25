"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Select from "../ui/Select";
import CategoryFilter from "../CategoryFilter";
import AppFilter from "../AppFilter";
import { COUNTRY_OPTIONS, DEFAULT_COUNTRY_CODE } from "@/lib/prospectingLabels";

const MODE_OPTIONS = [
  { value: "filters", label: "A partir de filtros" },
  { value: "manual", label: "Lista manual de domínios" },
];

const TARGET_MODE_OPTIONS = [
  { value: "leads", label: "Número de leads" },
  { value: "domains", label: "Principais N domínios" },
];

const PLATFORM_OPTIONS = [
  { value: "", label: "Todas as plataformas" },
  { value: "Shopify", label: "Shopify" },
  { value: "WooCommerce", label: "WooCommerce" },
  { value: "BigCommerce", label: "BigCommerce" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[10px] font-bold text-text-strong-950/70 uppercase tracking-widest">
      {children}
    </label>
  );
}

const inputCls =
  "h-10 w-full rounded-lg border border-stroke-soft-200 px-3 text-sm text-text-strong-950 placeholder-text-soft-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-action-ring)]";

export default function CreateCampaignForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [inputMode, setInputMode] = useState("filters");
  const [jobTitles, setJobTitles] = useState("");
  const [targetMode, setTargetMode] = useState("leads");
  const [targetLeadCount, setTargetLeadCount] = useState("3000");
  const [targetDomainCount, setTargetDomainCount] = useState("150");

  // filters mode
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [platform, setPlatform] = useState("");
  const [minRevenue, setMinRevenue] = useState("");
  const [maxRevenue, setMaxRevenue] = useState("");
  const [c1, setC1] = useState("");
  const [c2, setC2] = useState("");
  const [c3, setC3] = useState("");
  const [app, setApp] = useState("");

  // manual mode
  const [domainsText, setDomainsText] = useState("");

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const body: Record<string, unknown> = {
      inputMode,
      jobTitles: jobTitles
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      targetMode,
      ...(targetMode === "domains"
        ? { targetDomainCount: Number(targetDomainCount) || 150 }
        : { targetLeadCount: Number(targetLeadCount) || 3000 }),
    };

    if (inputMode === "filters") {
      body.filters = {
        countryCode,
        platform: platform || undefined,
        minRevenue: minRevenue || undefined,
        maxRevenue: maxRevenue || undefined,
        c1: c1 || undefined,
        c2: c2 || undefined,
        c3: c3 || undefined,
        app: app || undefined,
      };
    } else {
      body.domains = domainsText
        .split(/[\n,]+/)
        .map((d) => d.trim())
        .filter(Boolean);
    }

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha ao criar campanha");
      router.push(`/campaigns/${data.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao criar campanha");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      <div className="flex flex-col gap-1.5">
        <Label>Origem</Label>
        <Select value={inputMode} onChange={setInputMode} options={MODE_OPTIONS} variant="primary" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Segmentar por</Label>
        <Select value={targetMode} onChange={setTargetMode} options={TARGET_MODE_OPTIONS} />
      </div>

      {targetMode === "domains" ? (
        <div className="flex flex-col gap-1.5">
          <Label>Principais domínios</Label>
          <input
            type="number"
            value={targetDomainCount}
            onChange={(e) => setTargetDomainCount(e.target.value)}
            placeholder="150"
            className={inputCls}
          />
          <p className="text-[11px] text-text-strong-950/45">
            Busca essa quantidade de principais domínios (maior receita primeiro) e executa a
            qualificação em todos eles, independentemente da fração que for qualificada.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Meta de leads</Label>
          <input
            type="number"
            value={targetLeadCount}
            onChange={(e) => setTargetLeadCount(e.target.value)}
            placeholder="3000"
            className={inputCls}
          />
          <p className="text-[11px] text-text-strong-950/45">Interrompe quando os leads qualificados atingirem esse número.</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label>Cargos (para o link da Apollo)</Label>
        <input
          value={jobTitles}
          onChange={(e) => setJobTitles(e.target.value)}
          placeholder="CEO, Fundador, Head de Marketing"
          className={inputCls}
        />
      </div>

      <div className="h-px bg-bg-weak-50" />

      {inputMode === "filters" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label>País</Label>
            <Select value={countryCode} onChange={setCountryCode} options={COUNTRY_OPTIONS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Plataforma</Label>
            <Select value={platform} onChange={setPlatform} options={PLATFORM_OPTIONS} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Faixa de faturamento anual</Label>
            <p className="text-[11px] text-text-strong-950/45">Estimativas da fonte de dados em dólares (US$).</p>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                placeholder="Mín."
                value={minRevenue}
                onChange={(e) => setMinRevenue(e.target.value)}
                className={inputCls}
              />
              <span className="text-text-strong-950/30 text-sm shrink-0">–</span>
              <input
                type="number"
                placeholder="Máx."
                value={maxRevenue}
                onChange={(e) => setMaxRevenue(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Categoria</Label>
            <CategoryFilter
              countryCode={countryCode}
              c1={c1}
              c2={c2}
              c3={c3}
              onChange={(updates) => {
                if ("c1" in updates) { setC1(updates.c1); setC2(updates.c2 ?? ""); setC3(updates.c3 ?? ""); }
                else if ("c2" in updates) { setC2(updates.c2); setC3(updates.c3 ?? ""); }
                else if ("c3" in updates) setC3(updates.c3);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Aplicativo instalado</Label>
            <AppFilter value={app} onChange={setApp} />
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label>Domínios (um por linha)</Label>
          <textarea
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            placeholder={"brand-one.com\nbrand-two.com"}
            rows={6}
            className="w-full resize-y rounded-lg border border-stroke-soft-200 px-3 py-2 text-sm text-text-strong-950 placeholder-text-soft-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[var(--color-action-ring)]"
          />
        </div>
      )}

      {error && <p className="text-xs text-[var(--color-error-dark)]">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--color-action-bg)] text-sm font-semibold text-[var(--color-action-text)] transition-colors hover:bg-[var(--color-action-bg-hover)] disabled:opacity-60"
      >
        {submitting && (
          <div className="size-4 animate-spin rounded-full border-2 border-[var(--color-action-text)]/40 border-t-[var(--color-action-text)]" />
        )}
        {submitting ? "Criando…" : "Criar campanha"}
      </button>
    </div>
  );
}
