"use client";

import { useEffect, useRef, useState } from "react";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiBracesLine,
  RiDeleteBinLine,
  RiArrowDownDoubleLine,
  RiArrowUpDoubleLine,
  RiFileCopyLine,
  RiFileList2Line,
  RiQuillPenLine,
} from "@remixicon/react";
import * as Button from "@/components/alignui/button";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { crmFetch, errorMessage } from "./crm-utils";
import {
  MAX_AI_INSTRUCTIONS_TOTAL_LENGTH,
  MAX_AI_INSTRUCTION_BLOCKS,
  MAX_AI_INSTRUCTION_CONTENT_LENGTH,
  MAX_AI_INSTRUCTION_TITLE_LENGTH,
  renderAiInstructions,
  type AiInstructionBlock,
} from "@/lib/crm/ai/instructions";
import { cn } from "@/utils/cn";

export type InstructionField = "draftInstructions" | "classificationInstructions" | "callingInstructions";
type Lists = Record<InstructionField, AiInstructionBlock[]>;

/** A small ghost icon button; the label is its tooltip and its accessible name. */
function IconButton({
  label,
  icon,
  onClick,
  disabled,
  className,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Button.Root type="button" variant="neutral" mode="ghost" size="xsmall" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={className}>
      <Button.Icon as={icon} />
    </Button.Root>
  );
}

const newId = () => crypto.randomUUID();

function signature(blocks: AiInstructionBlock[]): string {
  return JSON.stringify(blocks.map((b) => [b.id, b.title.trim(), b.content.trim()]));
}

function validate(blocks: AiInstructionBlock[]): string | null {
  if (blocks.length > MAX_AI_INSTRUCTION_BLOCKS) {
    return `No máximo ${MAX_AI_INSTRUCTION_BLOCKS} instruções (${blocks.length} agora).`;
  }
  const longTitle = blocks.find((b) => b.title.length > MAX_AI_INSTRUCTION_TITLE_LENGTH);
  if (longTitle) return `“${longTitle.title.slice(0, 30)}…” tem um título com mais de ${MAX_AI_INSTRUCTION_TITLE_LENGTH} caracteres.`;
  const longContent = blocks.find((b) => b.content.length > MAX_AI_INSTRUCTION_CONTENT_LENGTH);
  if (longContent) {
    return `“${longContent.title.trim() || "Instrução sem título"}” tem mais de ${MAX_AI_INSTRUCTION_CONTENT_LENGTH} caracteres.`;
  }
  const total = renderAiInstructions(blocks)?.length ?? 0;
  if (total > MAX_AI_INSTRUCTIONS_TOTAL_LENGTH) {
    return `Juntas, as instruções têm ${total} caracteres; o limite é ${MAX_AI_INSTRUCTIONS_TOTAL_LENGTH}.`;
  }
  return null;
}

function InstructionRow({
  block,
  expanded,
  autoFocus,
  placeholder,
  onToggle,
  onChange,
  onDuplicate,
  onDelete,
}: {
  block: AiInstructionBlock;
  expanded: boolean;
  autoFocus: boolean;
  placeholder: string;
  onToggle: () => void;
  onChange: (patch: Partial<AiInstructionBlock>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);
  const panelId = `crm-ai-block-${block.id}`;
  const over = block.content.length > MAX_AI_INSTRUCTION_CONTENT_LENGTH;

  return (
    <li className={cn(expanded && "bg-bg-weak-50/40")}>
      <div
        className="flex cursor-pointer items-center gap-1.5 px-2 py-2 sm:px-3"
        onClick={(event) => {
          if (event.target === event.currentTarget) onToggle();
        }}
      >
        <Button.Root
          type="button"
          variant="neutral"
          mode="ghost"
          size="xsmall"
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-label={expanded ? "Recolher instrução" : "Expandir instrução"}
          title={expanded ? "Recolher" : "Expandir"}
          onClick={onToggle}
        >
          <Button.Icon as={RiArrowDownSLine} className={cn("transition-transform duration-200", expanded && "rotate-180")} />
        </Button.Root>
        <input
          ref={titleRef}
          type="text"
          value={block.title}
          maxLength={MAX_AI_INSTRUCTION_TITLE_LENGTH}
          placeholder="Instrução sem título"
          aria-label="Título da instrução"
          onChange={(event) => onChange({ title: event.target.value })}
          className="h-8 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-label-sm text-text-strong-950 outline-none ring-1 ring-inset ring-transparent transition placeholder:text-text-sub-600 hover:ring-stroke-soft-200 focus:bg-bg-white-0 focus:shadow-button-important-focus focus:ring-stroke-strong-950"
        />
        {!expanded && (
          <span className={cn("hidden shrink-0 text-paragraph-xs tabular-nums sm:inline", over ? "text-error-base" : "text-text-sub-600")}>
            {block.content.trim() ? `${block.content.length.toLocaleString("pt-BR")} caracteres` : "Vazia"}
          </span>
        )}
        <IconButton label="Duplicar instrução" icon={RiFileCopyLine} onClick={onDuplicate} />
        <IconButton label="Excluir instrução" icon={RiDeleteBinLine} onClick={onDelete} className="hover:text-error-base" />
      </div>
      {expanded && (
        <div id={panelId} className="px-3 pb-3 sm:pl-12 sm:pr-4">
          <Textarea.Root
            simple
            rows={6}
            value={block.content}
            placeholder={placeholder}
            hasError={over}
            aria-label={`${block.title.trim() || "Instrução sem título"} — texto da instrução`}
            onChange={(event) => onChange({ content: event.target.value })}
            className="resize-y"
          />
          <div className={cn("mt-1 text-right text-paragraph-xs tabular-nums", over ? "text-error-base" : "text-text-sub-600")}>
            {block.content.length.toLocaleString("pt-BR")} / {MAX_AI_INSTRUCTION_CONTENT_LENGTH.toLocaleString("pt-BR")}
          </div>
        </div>
      )}
    </li>
  );
}

export function InstructionSection({
  title,
  helper,
  placeholder,
  emptyText,
  exportName,
  field,
  saved,
  pipelineId,
  onSaved,
  defaults,
  customized: savedCustomized,
}: {
  title: string;
  helper: string;
  placeholder: string;
  emptyText: string;
  exportName: string;
  field: InstructionField;
  saved: AiInstructionBlock[];
  pipelineId: string;
  onSaved: (blocks: AiInstructionBlock[]) => void;
  /** A list with built-in defaults (calling): shown while `customized` is false, with "Reset to defaults". */
  defaults?: AiInstructionBlock[];
  customized?: boolean;
}) {
  const dialogs = useDialogs();
  const [blocks, setBlocks] = useState(saved);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(saved.length === 1 ? [saved[0].id] : []),
  );
  const [focusId, setFocusId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [customized, setCustomized] = useState(savedCustomized ?? true);

  const dirty = signature(blocks) !== signature(saved);
  const problem = validate(blocks);
  const empty = blocks.length === 0;
  const allExpanded = !empty && blocks.every((b) => expanded.has(b.id));

  const edit = (next: AiInstructionBlock[]) => {
    setBlocks(next);
    setSuccess(false);
  };
  const setOpen = (id: string, open: boolean) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  const add = () => {
    const id = newId();
    edit([...blocks, { id, title: "", content: "" }]);
    setOpen(id, true);
    setFocusId(id);
  };
  const duplicate = (index: number) => {
    const source = blocks[index];
    const id = newId();
    const copy = { id, title: `${source.title.trim()} (cópia)`.trim(), content: source.content };
    edit([...blocks.slice(0, index + 1), copy, ...blocks.slice(index + 1)]);
    setOpen(id, true);
  };
  const remove = async (block: AiInstructionBlock) => {
    if (block.content.trim()) {
      const confirmed = await dialogs.confirm({
        title: "Excluir instrução?",
        description: `“${block.title.trim() || "Instrução sem título"}” será removida desta lista. Salve para aplicar.`,
        confirmLabel: "Excluir instrução",
        variant: "error",
      });
      if (!confirmed) return;
    }
    setBlocks((current) => current.filter((b) => b.id !== block.id));
    setSuccess(false);
  };

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(renderAiInstructions(blocks) ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Não foi possível copiar para a área de transferência.");
    }
  };
  const exportJson = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(blocks, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = exportName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      const result = await crmFetch<Partial<Lists> & { callingInstructionsCustomized?: boolean }>("/settings/ai-instructions", {
        method: "PUT",
        body: JSON.stringify({ pipelineId, [field]: blocks }),
      });
      const next = result[field] ?? [];
      if (defaults) setCustomized(result.callingInstructionsCustomized ?? true);
      setBlocks(next);
      setExpanded((current) => new Set([...current].filter((id) => next.some((b) => b.id === id))));
      onSaved(next);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2500);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };
  const discard = () => {
    setBlocks(saved);
    setError("");
    setSuccess(false);
  };
  const resetToDefaults = async () => {
    if (!defaults) return;
    const confirmed = await dialogs.confirm({
      title: "Restaurar as instruções padrão?",
      description: "Suas edições serão substituídas pelas instruções internas. Não é preciso salvar.",
      confirmLabel: "Restaurar",
      variant: "error",
    });
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      const result = await crmFetch<Partial<Lists>>("/settings/ai-instructions", {
        method: "PUT",
        body: JSON.stringify({ pipelineId, [field]: null }),
      });
      const next = result[field] ?? defaults;
      setBlocks(next);
      setCustomized(false);
      onSaved(next);
      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 2500);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const total = renderAiInstructions(blocks)?.length ?? 0;

  return (
    <Frame>
      <FrameHeader
        title={title}
        description={helper}
        actions={
          <div className="flex items-center gap-0.5">
            {copied && <span role="status" className="mr-1 text-paragraph-xs text-success-base">Copiado</span>}
            <IconButton label={copied ? "Copiado" : "Copiar todas"} icon={RiFileList2Line} disabled={empty} onClick={() => void copyAll()} />
            <IconButton label="Exportar JSON" icon={RiBracesLine} disabled={empty} onClick={exportJson} />
            <IconButton
              label={allExpanded ? "Recolher todas" : "Expandir todas"}
              icon={allExpanded ? RiArrowUpDoubleLine : RiArrowDownDoubleLine}
              disabled={empty}
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(blocks.map((b) => b.id)))}
            />
            <Button.Root type="button" variant="neutral" mode="stroke" size="xsmall" className="ml-1.5" disabled={blocks.length >= MAX_AI_INSTRUCTION_BLOCKS} onClick={add}>
              <Button.Icon as={RiAddLine} />
              Adicionar instrução
            </Button.Root>
          </div>
        }
      />
      <FramePanel className="overflow-hidden p-0 sm:p-0">
        {defaults && !customized && !dirty && (
          <p className="border-b border-stroke-soft-200 bg-bg-weak-50 px-3 py-2 text-paragraph-xs text-text-sub-600 sm:px-4">
            Estas são as instruções internas. Edite e salve para personalizá-las; Restaurar traz de volta o padrão.
          </p>
        )}
        {empty ? (
          <EmptyState
            compact
            icon={RiQuillPenLine}
            title="Ainda não há instruções"
            description={emptyText}
            action={
              <Button.Root type="button" variant="neutral" mode="stroke" size="small" onClick={add}>
                <Button.Icon as={RiAddLine} />
                Adicionar instrução
              </Button.Root>
            }
          />
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {blocks.map((block, index) => (
              <InstructionRow
                key={block.id}
                block={block}
                expanded={expanded.has(block.id)}
                autoFocus={focusId === block.id}
                placeholder={placeholder}
                onToggle={() => setOpen(block.id, !expanded.has(block.id))}
                onChange={(patch) => edit(blocks.map((b) => (b.id === block.id ? { ...b, ...patch } : b)))}
                onDuplicate={() => duplicate(index)}
                onDelete={() => void remove(block)}
              />
            ))}
          </ul>
        )}
      </FramePanel>
      <footer className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 pb-2 pt-2.5 sm:px-4">
        <div className="min-h-5 min-w-0 text-paragraph-xs">
          {problem ? (
            <span role="alert" className="text-error-base">{problem}</span>
          ) : error ? (
            <span role="alert" className="text-error-base">{error}</span>
          ) : success && !dirty ? (
            <span role="status" className="text-success-base">Salvo</span>
          ) : dirty ? (
            <span className="text-warning-dark">Alterações não salvas</span>
          ) : (
            <span className="tabular-nums text-text-sub-600">
              {blocks.length} de {MAX_AI_INSTRUCTION_BLOCKS} instruções · {total.toLocaleString("pt-BR")} de {MAX_AI_INSTRUCTIONS_TOTAL_LENGTH.toLocaleString("pt-BR")} caracteres
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {defaults && (
            <Button.Root type="button" variant="neutral" mode="ghost" size="small" disabled={saving || (!customized && !dirty)} onClick={() => void resetToDefaults()}>
              Restaurar padrão
            </Button.Root>
          )}
          <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={!dirty || saving} onClick={discard}>
            Descartar
          </Button.Root>
          <Button.Root type="button" variant="primary" mode="filled" size="small" disabled={!dirty || saving || !!problem || !pipelineId} onClick={() => void save()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button.Root>
        </div>
      </footer>
    </Frame>
  );
}

export const INSTRUCTION_SECTIONS = {
  draftInstructions: {
    title: "Criação de respostas",
    helper: "Adicionado a todos os rascunhos que a IA cria — e-mail, LinkedIn e WhatsApp.",
    placeholder: "Assine como Priya da Youse. Mantenha os e-mails abaixo de 120 palavras. Nunca ofereça descontos; sugira uma ligação de 20 minutos.",
    emptyText: "Ainda não há instruções — adicione uma para orientar todos os rascunhos.",
    exportName: "reply-drafting-instructions.json",
  },
  classificationInstructions: {
    title: "Classificação de respostas",
    helper: "Adicionado a toda classificação de uma resposta ou ligação.",
    placeholder: "Uma indicação a um colega conta como Interessado, não Outro. Respostas de agências são Não interessado.",
    emptyText: "Ainda não há instruções — adicione uma para orientar toda classificação.",
    exportName: "reply-classification-instructions.json",
  },
  callingInstructions: {
    title: "Ligações",
    helper:
      "Como o agente de IA conduz cada ligação no WhatsApp: a abertura, o formato da chamada e o jeito de falar. Use {{agentName}} e {{firstName}}. Quem ele é, ser honesto de que é uma IA, o objetivo de cada campanha e o encerramento permanecem fixos. Teste alterações com uma ligação de ensaio na sequência de uma campanha.",
    placeholder: "Nunca cite concorrentes pelo nome. Se disserem que já usam uma agência, pergunte o que a agência faz pelas páginas de destino deles.",
    emptyText: "Sem instruções de ligação — salvar uma lista vazia restaura os padrões.",
    exportName: "calling-instructions.json",
  },
} as const satisfies Record<InstructionField, { title: string; helper: string; placeholder: string; emptyText: string; exportName: string }>;
