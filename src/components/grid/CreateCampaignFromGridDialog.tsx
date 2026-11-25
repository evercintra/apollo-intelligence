"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RiCloseLine, RiLoader4Line, RiMegaphoneLine } from "@remixicon/react";
import * as Select from "@/components/alignui/select";
import type { GridColumn } from "@/lib/grid/schema";
import type { GridCampaignChannel, GridCampaignMapping } from "@/lib/leads/gridCampaigns";

const PERSON_FIELDS: { key: keyof GridCampaignMapping; label: string }[] = [
  { key: "email", label: "E-mail" },
  { key: "linkedinUrl", label: "URL do LinkedIn" },
  { key: "firstName", label: "Nome" },
  { key: "lastName", label: "Sobrenome" },
  { key: "fullName", label: "Nome completo" },
  { key: "title", label: "Cargo" },
  { key: "companyName", label: "Nome da empresa" },
  { key: "companyDomain", label: "Domínio da empresa" },
];

const LINKEDIN_FIELDS: { key: keyof GridCampaignMapping; label: string }[] = [
  { key: "invitationMessage", label: "Mensagem de convite" },
  { key: "acceptanceMessage", label: "Mensagem de aceite" },
  { key: "followUp1Message", label: "Acompanhamento 1" },
  { key: "followUp2Message", label: "Acompanhamento 2" },
  { key: "followUp3Message", label: "Acompanhamento 3" },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function suggestedMapping(columns: GridColumn[]): GridCampaignMapping {
  const aliases: Record<string, string[]> = {
    email: ["email", "emailaddress", "workemail"],
    linkedinUrl: ["linkedin", "linkedinurl", "linkedinprofile", "profileurl"],
    firstName: ["firstname", "first"],
    lastName: ["lastname", "last"],
    fullName: ["fullname", "name"],
    title: ["title", "jobtitle", "headline"],
    companyName: ["company", "companyname"],
    companyDomain: ["domain", "companydomain", "website"],
    invitationMessage: ["invitationmessage", "invitation"],
    acceptanceMessage: ["acceptancemessage", "acceptance"],
    followUp1Message: ["followup1", "followup1message"],
    followUp2Message: ["followup2", "followup2message"],
    followUp3Message: ["followup3", "followup3message"],
  };
  return Object.fromEntries(Object.entries(aliases).flatMap(([field, names]) => {
    const column = columns.find((candidate) => names.includes(normalize(candidate.name)));
    return column ? [[field, column.key]] : [];
  })) as GridCampaignMapping;
}

export default function CreateCampaignFromGridDialog({
  open,
  tableId,
  columns,
  rowIds,
  onClose,
  onCreated,
}: {
  open: boolean;
  tableId: string;
  columns: GridColumn[];
  rowIds: string[];
  onClose: () => void;
  onCreated: (result: { campaignId: string; channel: GridCampaignChannel; created: number; failed: number }) => void;
}) {
  const [channel, setChannel] = useState<GridCampaignChannel>("email");
  const [name, setName] = useState("");
  const [mapping, setMapping] = useState<GridCampaignMapping>(() => suggestedMapping(columns));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(
    () => channel === "linkedin" ? [...PERSON_FIELDS, ...LINKEDIN_FIELDS] : PERSON_FIELDS,
    [channel],
  );
  const requiredField = channel === "email" ? "email" : "linkedinUrl";

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/grid/tables/${tableId}/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, name, rowIds, mapping }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Não foi possível criar a campanha");
      onCreated(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível criar a campanha");
    } finally {
      setBusy(false);
    }
  }

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-bg-white-0 shadow-xl ring-1 ring-stroke-soft-200">
        <div className="flex items-start justify-between border-b border-stroke-soft-200 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-text-strong-950">Criar campanha a partir das linhas selecionadas</h2>
            <p className="text-[13px] text-text-sub-600">As pessoas serão criadas somente após você confirmar este mapeamento.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-md p-1 text-text-soft-400 hover:bg-bg-weak-50"><RiCloseLine className="size-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-[13px] font-medium text-text-strong-950">Canal
              <Select.Root size="small" value={channel} onValueChange={(next) => setChannel(next as GridCampaignChannel)}>
                <Select.Trigger aria-label="Canal" className="mt-1.5 w-full font-normal">
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="email">E-mail</Select.Item>
                  <Select.Item value="linkedin">LinkedIn</Select.Item>
                </Select.Content>
              </Select.Root>
            </label>
            <label className="text-[13px] font-medium text-text-strong-950">Nome da campanha
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Divulgação do 3º trimestre" className="mt-1.5 w-full rounded-lg border border-stroke-soft-200 px-3 py-2 font-normal outline-none focus:border-[var(--color-action-ring)]" />
            </label>
          </div>
          <div className="mt-5 overflow-hidden rounded-xl border border-stroke-soft-200">
            <div className="grid grid-cols-2 bg-bg-weak-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-text-sub-600"><span>Campo da campanha</span><span>Coluna da grade</span></div>
            {fields.map((field) => (
              <div key={field.key} className="grid grid-cols-2 items-center gap-3 border-t border-stroke-soft-200 px-3 py-2">
                <span className="text-[13px] text-text-strong-950">{field.label}{field.key === requiredField ? <span className="ml-1 text-[var(--color-error-base)]">*</span> : null}</span>
                <Select.Root size="small" value={mapping[field.key] ?? ""} onValueChange={(next) => setMapping((current) => ({ ...current, [field.key]: next || undefined }))}>
                  <Select.Trigger aria-label={`${field.label} column`}>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value="">Não mapear</Select.Item>
                    {columns.map((column) => <Select.Item key={column.key} value={column.key}>{column.name}</Select.Item>)}
                  </Select.Content>
                </Select.Root>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-lg bg-[var(--color-complement-surface)] px-3 py-2 text-[12px] text-[var(--color-complement-deep)]">Toda coluna não mapeada é preservada nos dados brutos de People e exposta como variável de template. Esta ação cria uma campanha e inscreve apenas {rowIds.length} linha{rowIds.length === 1 ? "" : "s"} selecionada{rowIds.length === 1 ? "" : "s"}.</p>
          {error && <p className="mt-3 rounded-lg bg-[var(--color-error-lighter)] px-3 py-2 text-[13px] text-[var(--color-error-dark)]">{error}</p>}
        </div>
        <div className="flex items-center justify-between border-t border-stroke-soft-200 px-5 py-4">
          <span className="text-[13px] text-text-sub-600">{rowIds.length} selecionadas</span>
          <div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-stroke-soft-200 px-3 py-2 text-[13px] font-medium text-text-strong-950">Cancelar</button><button type="button" onClick={() => void create()} disabled={busy || !name.trim() || !mapping[requiredField]} className="flex items-center gap-2 rounded-lg bg-[var(--color-action-bg)] px-3 py-2 text-[13px] font-medium text-[var(--color-action-text)] disabled:opacity-50">{busy ? <RiLoader4Line className="size-4 animate-spin" /> : <RiMegaphoneLine className="size-4" />}Criar campanha</button></div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
