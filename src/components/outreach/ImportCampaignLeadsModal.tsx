"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import CampaignCsvMappingDialog from "@/components/leads/CampaignCsvMappingDialog";

type ImportResult = {
  total: number;
  imported: number;
  skippedSuppressed: number;
  skippedDuplicate: number;
  failed: { row: number; email: string; error: string }[];
};

/** Modal for bulk-importing leads into a campaign from a .csv/.xlsx file. */
export default function ImportCampaignLeadsModal({
  campaignId,
  onClose,
  onImported,
}: {
  campaignId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [mappingFile, setMappingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }
    setError(null);
    setResult(null);
    setMappingFile(file);
  }

  if (mappingFile) {
    return <CampaignCsvMappingDialog
      file={mappingFile}
      endpoint={`/api/outreach/campaigns/${campaignId}/leads/import`}
      channel="email"
      onClose={() => setMappingFile(null)}
      onImported={(data) => {
        setResult(data as unknown as ImportResult);
        setMappingFile(null);
        onImported();
      }}
    />;
  }

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-apollo-graphite-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-bg-white-0 rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-text-strong-950">Importar leads</h2>
            <p className="text-sm text-text-strong-950/60 mt-0.5">Envie um arquivo .csv ou .xlsx</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-text-strong-950/50 hover:bg-bg-weak-50 hover:text-text-strong-950/70 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-xs text-text-strong-950/45 mb-4">
          Após selecionar um arquivo, mapeie as colunas para E-mail, nome, empresa e outros campos canônicos.
          As colunas não mapeadas continuam disponíveis como variáveis de modelo, e destinatários suprimidos são ignorados.
        </p>

        <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-stroke-soft-200 rounded-xl px-4 py-8 cursor-pointer hover:border-complement-ring transition-colors">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          <svg className="w-6 h-6 text-text-strong-950/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13.5V6.75m0 0l-3 3m3-3l3 3M6 20.25h12A2.25 2.25 0 0020.25 18v-9a2.25 2.25 0 00-2.25-2.25H15" />
          </svg>
          <span className="text-sm text-text-strong-950/60">{fileName ?? "Clique para escolher um arquivo"}</span>
        </label>

        {error && <p className="text-xs text-error-base mt-3">{error}</p>}

        {result && (
          <div className="mt-4 rounded-lg bg-bg-weak-50 border border-stroke-soft-200 px-3 py-3 text-sm">
            <p className="text-text-strong-950">
              <span className="font-semibold">{result.total}</span> linhas —{" "}
              <span className="text-success-base font-medium">{result.imported} importados</span>
              {result.skippedDuplicate > 0 && `, ${result.skippedDuplicate} duplicados`}
              {result.skippedSuppressed > 0 && (
                <>
                  , <span className="text-warning-base font-medium">{result.skippedSuppressed} suprimidos</span>
                </>
              )}
              {result.failed.length > 0 && (
                <>
                  , <span className="text-error-base font-medium">{result.failed.length} com falha</span>
                </>
              )}
            </p>
            {result.failed.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto">
                {result.failed.map((f) => (
                  <li key={f.row} className="text-xs text-error-base">
                    Linha {f.row} ({f.email || "desconhecido"}): {f.error}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-strong-950/70 border border-stroke-soft-200 rounded-lg hover:bg-bg-weak-50 transition-colors"
          >
            {result ? "Fechar" : "Cancelar"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!fileName}
              className="flex-1 px-4 py-2.5 text-sm font-medium bg-accent-base text-accent-contrast rounded-lg hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Mapear colunas
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
