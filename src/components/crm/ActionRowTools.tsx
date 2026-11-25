"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { DraftRecipients } from "./DraftRecipients";
import { useEffect, useRef, useState } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  RiArrowDownSLine,
  RiArrowRightLine,
  RiCalendarScheduleLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiRefreshLine,
  RiSaveLine,
  RiSendPlaneLine,
  RiSparklingLine,
  RiTimerLine,
} from "@remixicon/react";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import { cn } from "@/utils/cn";
import { dangerButtonClass, fieldClass, primaryButtonClass, secondaryButtonClass, subtleButtonClass } from "./CrmLayout";
import { defaultStageChangeNext, STAGE_CHANGE_NOTE_MAX, type StageChangeNext } from "@/lib/crm/stageChange";
import { followUpNoteError, FOLLOW_UP_NOTE_MAX } from "@/lib/crm/followUpNote";
import { daysBetween, followUpDateError, followUpDueIn, followUpDueOn, FOLLOW_UP_PRESETS, MAX_FOLLOW_UP_DAYS, toDateInputValue } from "@/lib/crm/followUpDate";
import { asList, asObject, CATEGORY_COLOR, CATEGORY_LABELS, categoryColor, formatDate } from "./crm-utils";

type Data = Record<string, unknown>;

const STATUS_LABEL_PT: Record<string, string> = {
  unclassified: "Sem classificação",
  awaiting_review: "Aguardando revisão",
  failed: "Falhou",
  draft: "Rascunho",
  proposed: "Proposto",
  sent: "Enviado",
  delivered: "Entregue",
  answered: "Respondido",
};

const FOLLOW_UP_PRESET_LABEL_PT: Record<string, string> = {
  Tomorrow: "Amanhã",
  "1 week": "1 semana",
  "1 month": "1 mês",
  "3 months": "3 meses",
};

function localizeError(message: string | null): string | null {
  if (!message) return null;
  return message
    .replace("Pick a valid date.", "Escolha uma data válida.")
    .replace("Pick a date in the future.", "Escolha uma data futura.")
    .replace(/Pick a date within (\d+) days\./, "Escolha uma data dentro de $1 dias.")
    .replace("Say why it is later and what should happen then.", "Diga por que é depois e o que deve acontecer então.")
    .replace(/Keep the note under (\d+) characters\./, "Mantenha a nota com menos de $1 caracteres.");
}

export function humanize(value: unknown): string {
  const key = String(value ?? "").trim();
  if (key in CATEGORY_LABELS) return CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS];
  if (key in STATUS_LABEL_PT) return STATUS_LABEL_PT[key];
  const input = key.replaceAll("_", " ").replaceAll(".", " ").trim();
  return input ? input.charAt(0).toUpperCase() + input.slice(1) : "—";
}

export type ClassificationChoice = { categoryKey: string; subcategoryId: string | null };

/** What the confirm step adds to a pick: what happens next, and what happened. */
export type StageChangeExtra = { next: StageChangeNext; note: string | null };

/**
 * Badge colours per category, the CRM identity colours Analytics uses:
 * interested green, customer purple, not interested red, other amber. The
 * tint alone carries the category — chips have no dot.
 */
export const categoryToneClass: Record<string, string> = {
  customer: CATEGORY_COLOR.customer.tone,
  interested: CATEGORY_COLOR.interested.tone,
  not_interested: CATEGORY_COLOR.not_interested.tone,
  other: CATEGORY_COLOR.other.tone,
};

/** The category's swatch as a small dot, for menu rows and filter options (chips are tinted instead). */
export function CategoryDot({ categoryKey, className }: { categoryKey: string | null | undefined; className?: string }) {
  return <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", className)} style={{ backgroundColor: categoryColor(categoryKey).color }} />;
}

/**
 * One control for the whole taxonomy: every active subcategory grouped under
 * its category, so picking a subcategory sets both. The bare categories lead
 * each group for the replies no subcategory describes.
 *
 * `compact` renders it as a badge that opens a menu, for the table. The badge
 * names the subcategory when there is one — "Meeting requested" says more
 * than "Interested" — and takes its colour from the category, so the column
 * still scans by outcome. The sequence and next draft follow whatever is
 * picked here, which is why it is worth having on the row at all.
 */
export function ClassificationPicker({ categories, categoryKey, subcategoryId, subcategoryName, onChange, confirm, compact, quiet, disabled, className, title }: {
  categories: Data[];
  categoryKey: string | null;
  subcategoryId: string | null;
  subcategoryName?: string | null;
  onChange: (choice: ClassificationChoice, extra?: StageChangeExtra) => void | Promise<unknown>;
  /**
   * Opt in to the "What next?" confirm step: picking a stage opens it instead
   * of applying at once, and `onChange` then gets the rep's choice as `extra`.
   * `inboundAnswered` sets the default (the reply was already answered).
   */
  confirm?: { inboundAnswered: boolean };
  compact?: boolean;
  /**
   * With `compact`: unclassified gets a dashed outline instead of the grey
   * tint — it is a gap to fill, not a category.
   */
  quiet?: boolean;
  disabled?: boolean;
  className?: string;
  /** Overrides the compact badge's hover title — used where a second, different action (Move stage) sits next to it and the two need to read as distinct. */
  title?: string;
}) {
  const value = subcategoryId || (categoryKey ? `category:${categoryKey}` : "");
  const save = (next: string) => {
    if (!next) return;
    const chosen: ClassificationChoice = next.startsWith("category:")
      ? { categoryKey: next.slice("category:".length), subcategoryId: null }
      : {
        categoryKey: String(categories.flatMap((item) => asList<Data>(item.subcategories)).find((item) => String(item.id) === next)?.categoryKey ?? categoryKey ?? "other"),
        subcategoryId: next,
      };
    if (chosen.categoryKey === categoryKey && (chosen.subcategoryId ?? "") === (subcategoryId ?? "")) return;
    if (confirm) setPending(chosen);
    else void onChange(chosen);
  };
  const [pending, setPending] = useState<ClassificationChoice | null>(null);
  const pendingLabel = pending
    ? pending.subcategoryId
      ? String(categories.flatMap((item) => asList<Data>(item.subcategories)).find((item) => String(item.id) === pending.subcategoryId)?.name ?? humanize(pending.categoryKey))
      : humanize(pending.categoryKey)
    : "";
  const confirmDialog = confirm && <StageChangeConfirm
    stage={pending ? pendingLabel : null}
    inboundAnswered={confirm.inboundAnswered}
    onCancel={() => setPending(null)}
    onApply={async (extra) => { const choice = pending; setPending(null); if (choice) await onChange(choice, extra); }}
  />;
  const groups = categories.map((category) => ({
    key: String(category.key),
    subcategories: asList<Data>(category.subcategories).filter((item) => item.active !== false),
  }));
  const categoryLabel = categoryKey ? humanize(categoryKey) : "Sem classificação";

  if (!compact) {
    return (
      <>
      {confirmDialog}
      <Select.Root
        size="xsmall"
        value={value}
        disabled={disabled}
        onValueChange={(next) => save(next)}
      >
        <Select.Trigger aria-label="Classificação" className={cn("max-w-56", className)}>
          <Select.Value placeholder="Sem classificação" />
        </Select.Trigger>
        <Select.Content>
          {groups.length === 0 && categoryKey && <Select.Item value={value}>{categoryLabel}{subcategoryName ? ` · ${subcategoryName}` : ""}</Select.Item>}
          {groups.map((group) => (
            <Select.Group key={group.key}>
              <Select.GroupLabel>{humanize(group.key)}</Select.GroupLabel>
              <Select.Item value={`category:${group.key}`}>{humanize(group.key)} · sem subcategoria</Select.Item>
              {group.subcategories.map((item) => <Select.Item key={String(item.id)} value={String(item.id)}>{String(item.name)}</Select.Item>)}
            </Select.Group>
          ))}
        </Select.Content>
      </Select.Root>
      </>
    );
  }

  const label = subcategoryName || categoryLabel;
  const tone = quiet && !categoryKey
    ? "bg-bg-white-0 text-text-sub-600 ring-0 outline-dashed outline-1 -outline-offset-1 outline-stroke-sub-300 hover:bg-bg-weak-50"
    : categoryToneClass[categoryKey ?? ""] ?? "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200";
  return (
    <>
    {confirmDialog}
    <Dropdown.Root>
      <Dropdown.Trigger asChild>
        <button
          type="button"
          disabled={disabled || groups.length === 0}
          aria-label={`Classificação: ${label}. Alterar`}
          title={title ?? (subcategoryName ? `${categoryLabel} · ${subcategoryName}` : categoryLabel)}
          className={cn("inline-flex h-6 max-w-full items-center gap-1 rounded-md pl-2 pr-1.5 text-label-xs ring-1 ring-inset transition", categoryKey && "hover:brightness-95", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-strong-950 disabled:opacity-60 data-[state=open]:ring-2 data-[state=open]:ring-stroke-strong-950", tone, className)}
        >
          <span className="truncate">{label}</span>
          <RiArrowDownSLine className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
        </button>
      </Dropdown.Trigger>
      <ClassificationMenu groups={groups} value={value} onPick={save} />
    </Dropdown.Root>
    </>
  );
}

/**
 * The confirm step after a stage is picked: what should happen next, and
 * what happened (the AI uses the note in drafts). Cancel leaves the stage
 * as it was.
 */
function StageChangeConfirm({ stage, inboundAnswered, onCancel, onApply }: {
  /** The picked stage's name; null while closed. */
  stage: string | null;
  inboundAnswered: boolean;
  onCancel: () => void;
  onApply: (extra: StageChangeExtra) => Promise<void>;
}) {
  const open = stage !== null;
  const [next, setNext] = useState<StageChangeNext>(defaultStageChangeNext(inboundAnswered));
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { if (open) { setNext(defaultStageChangeNext(inboundAnswered)); setNote(""); setWorking(false); } }, [open, inboundAnswered]);
  const choices: { value: StageChangeNext; label: string; detail: string; icon: typeof RiSparklingLine }[] = [
    { value: "reply", label: "Criar uma resposta agora", detail: "Escreve a resposta deste estágio para você enviar.", icon: RiSparklingLine },
    { value: "follow_up", label: "Apenas agendar acompanhamentos", detail: "Sem resposta agora; os acompanhamentos deste estágio começam.", icon: RiTimerLine },
  ];
  const tooLong = note.length > STAGE_CHANGE_NOTE_MAX;
  const apply = async () => {
    if (working || tooLong) return;
    setWorking(true);
    try { await onApply({ next, note: note.trim() || null }); } finally { setWorking(false); }
  };
  return (
    <div className="contents" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <Modal.Root open={open} onOpenChange={(value) => { if (!value && !working) onCancel(); }}>
        <Modal.Content size="max-w-md">
          <Modal.Header icon={RiArrowRightLine}>
            <Modal.Title>Mover para {stage}</Modal.Title>
            <Modal.Description>O que deve acontecer a seguir?</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <div role="radiogroup" aria-label="Próxima ação?" className="grid gap-2">
              {choices.map((choice) => {
                const selected = next === choice.value;
                return (
                  <button key={choice.value} type="button" role="radio" aria-checked={selected} disabled={working} onClick={() => setNext(choice.value)} className={cn("flex items-start gap-2.5 rounded-lg p-3 text-left ring-1 ring-inset transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stroke-strong-950 disabled:opacity-60", selected ? "bg-bg-soft-200 ring-stroke-sub-300" : "bg-bg-white-0 ring-stroke-soft-200 hover:bg-bg-weak-50")}>
                    <choice.icon className="mt-0.5 size-4 shrink-0 text-text-sub-600" aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block text-label-sm text-text-strong-950">{choice.label}</span><span className="block text-paragraph-xs text-text-sub-600">{choice.detail}</span></span>
                    {selected && <RiCheckLine className="size-4 shrink-0 text-primary-base" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1">
              <span className="text-label-xs text-text-sub-600">O que aconteceu? (opcional; a IA usa nos rascunhos)</span>
              <textarea value={note} maxLength={STAGE_CHANGE_NOTE_MAX} disabled={working} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: querem preço para 50 lugares; incluir o CTO deles" className={cn(fieldClass, "min-h-20 resize-y leading-6")} />
            </label>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className={secondaryButtonClass} disabled={working} onClick={onCancel}>Cancelar</button>
            <button type="button" className={primaryButtonClass} disabled={working || tooLong} onClick={() => void apply()}>
              <RiCheckLine className="size-4" aria-hidden="true" />{working ? "Aplicando…" : "Aplicar"}
            </button>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </div>
  );
}

/**
 * The menu body. Each category heads its group as the same chip the table
 * shows, so the colours line up; the current choice is tinted and checked,
 * and the menu opens scrolled to it with focus there, so a long taxonomy
 * never has to be hunted through to find where the record stands.
 */
function ClassificationMenu({ groups, value, onPick }: {
  groups: { key: string; subcategories: Data[] }[];
  value: string;
  onPick: (next: string) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);
  // One step darker than the hover tint, so the current choice still reads
  // as "current" when the pointer is resting on a neighbour.
  const itemClass = (selected: boolean) => cn(selected && "bg-bg-soft-200 text-text-strong-950 data-[highlighted]:bg-bg-sub-300/60");
  const check = <RiCheckLine className="size-4 shrink-0 text-primary-base" aria-hidden="true" />;
  return (
    <Dropdown.Content ref={contentRef} align="start" className="max-h-80 w-64 overflow-y-auto">
      <RevealSelected contentRef={contentRef} itemRef={selectedRef} />
      {groups.map((group, index) => {
        const categoryValue = `category:${group.key}`;
        return (
          <Dropdown.Group key={group.key}>
            {index > 0 && <Dropdown.Separator />}
            <Dropdown.Item ref={value === categoryValue ? selectedRef : undefined} onSelect={() => onPick(categoryValue)} className={itemClass(value === categoryValue)}>
              <span className={cn("inline-flex h-6 items-center rounded-md px-2 text-label-xs ring-1 ring-inset", categoryToneClass[group.key] ?? "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200")}>{humanize(group.key)}</span>
              <span className="flex-1" />
              {value === categoryValue && check}
            </Dropdown.Item>
            {group.subcategories.map((item) => {
              const id = String(item.id);
              const selected = value === id;
              return (
                <Dropdown.Item key={id} ref={selected ? selectedRef : undefined} onSelect={() => onPick(id)} className={cn("pl-4 text-text-sub-600 data-[highlighted]:text-text-strong-950", itemClass(selected))}>
                  <span className="flex-1 truncate">{String(item.name)}</span>
                  {selected && check}
                </Dropdown.Item>
              );
            })}
          </Dropdown.Group>
        );
      })}
    </Dropdown.Content>
  );
}

/**
 * Radix mounts the menu body on every open, so an effect here runs exactly
 * then: it moves focus to the current choice and scrolls the menu (only the
 * menu, never the page behind it) so the choice sits mid-list.
 */
function RevealSelected({ contentRef, itemRef }: { contentRef: React.RefObject<HTMLDivElement | null>; itemRef: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    // After Radix's own open-focus has run, so ours is the one that sticks.
    const frame = requestAnimationFrame(() => {
      const item = itemRef.current;
      const content = contentRef.current;
      if (!item || !content) return;
      item.focus({ preventScroll: true });
      const box = content.getBoundingClientRect();
      const target = item.getBoundingClientRect();
      content.scrollTop += target.top - box.top - (box.height - target.height) / 2;
    });
    return () => cancelAnimationFrame(frame);
  }, [contentRef, itemRef]);
  return null;
}

/**
 * Full text on hover for a cell that only has room for one line. The card is
 * hoverable so a long message can be scrolled, and the trigger is focusable so
 * keyboard users get the same preview.
 *
 * `onActivate` makes the text itself a control: clicking it (or the card) runs
 * the action instead of letting the click reach the row and open the record —
 * a reader who clicks a draft means to edit it, not to leave the page.
 */
export function HoverPreview({ title, body, meta, children, className, onActivate, actions, disabled }: {
  title?: string;
  body: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
  onActivate?: () => void;
  /** Buttons shown along the bottom of the card; clicks there do not count as activating the card. */
  actions?: React.ReactNode;
  /** No card at all — for a row whose editor is already open underneath. */
  disabled?: boolean;
}) {
  // Controlled so that acting from the card (Edit, Send, or clicking the text)
  // also dismisses it: what the click produced is underneath, and the card
  // would otherwise sit on top of it until the pointer wandered off.
  const [open, setOpen] = useState(false);
  const activate = (event: React.MouseEvent) => {
    if (!onActivate) return;
    event.stopPropagation();
    // A click that ends a text selection is a read, not a request to edit.
    if (window.getSelection()?.toString()) return;
    setOpen(false);
    onActivate();
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!onActivate || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    setOpen(false);
    onActivate();
  };
  const triggerClass = cn("min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-stroke-strong-950", className);
  if (!body.trim() || disabled) return <div className={triggerClass} tabIndex={onActivate ? 0 : undefined} role={onActivate ? "button" : undefined} onClick={activate} onKeyDown={onKeyDown}>{children}</div>;
  return (
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger asChild>
        <div tabIndex={0} role={onActivate ? "button" : undefined} className={triggerClass} onClick={activate} onKeyDown={onKeyDown}>{children}</div>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="bottom" align="start" sideOffset={6} collisionPadding={12} onClick={activate} className={cn("z-50 w-[28rem] max-w-[calc(100vw-2rem)] rounded-xl bg-bg-white-0 p-3.5 shadow-regular-md ring-1 ring-inset ring-stroke-soft-200 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0", onActivate && "cursor-pointer")}>
          {(title || meta) && <div className="mb-2 flex items-baseline justify-between gap-3">
            {title && <p className="truncate text-label-sm text-text-strong-950">{title}</p>}
            {meta && <p className="shrink-0 text-paragraph-xs text-text-soft-400">{meta}</p>}
          </div>}
          <p className="max-h-72 overflow-y-auto whitespace-pre-wrap text-paragraph-sm leading-6 text-text-sub-600">{body}</p>
          {actions && <div className="mt-3 flex items-center gap-2 border-t border-stroke-soft-200 pt-3" onClick={(event) => { event.stopPropagation(); setOpen(false); }}>{actions}</div>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

export const HoverPreviewProvider = ({ children }: { children: React.ReactNode }) => <Tooltip.Provider delayDuration={350} skipDelayDuration={400}>{children}</Tooltip.Provider>;

/** Where a row's draft edits and sends go. `path` is relative to `/api/crm`. */
/** `onError`, when given, receives a failure's message instead of the page's notice bar, so a dialog can show it itself. */
export type RowMutation = (path: string, body: Data, method: string, success: string, onError?: (message: string) => void) => Promise<boolean>;

/** "Thu 20 Nov, 10:00–10:30" in the reader's local time (end shown with its date only when it falls on another day). */
export function formatMeetingRange(startAt: unknown, endAt: unknown): string {
  const start = new Date(String(startAt));
  const end = new Date(String(endAt));
  if (Number.isNaN(start.getTime())) return "—";
  const day = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const head = `${day.format(start)}, ${time.format(start)}`;
  if (Number.isNaN(end.getTime())) return head;
  return start.toDateString() === end.toDateString() ? `${head}–${time.format(end)}` : `${head} – ${day.format(end)}, ${time.format(end)}`;
}

export type MeetingOutcome = "showed" | "no_show";

/** The two answers to "Did they show up?"; the caller posts them and refreshes. */
export function MeetingOutcomeButtons({ busy, onAnswer, className }: { busy: boolean; onAnswer: (outcome: MeetingOutcome) => void; className?: string }) {
  return (
    <div data-row-tools className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <button type="button" className={cn(primaryButtonClass, "h-8")} disabled={busy} onClick={() => onAnswer("showed")}><RiCheckLine className="size-4" aria-hidden="true" />Compareceu</button>
      <button type="button" className={cn(secondaryButtonClass, "h-8")} disabled={busy} onClick={() => onAnswer("no_show")}>Não compareceu</button>
    </div>
  );
}

/** A row whose action is "Did they show up?": the meeting time and the two answers. */
export function MeetingOutcomeTools({ recordId, meeting, busy, onMutate }: {
  recordId: string;
  meeting: { id: string; startAt: string; endAt: string };
  busy: boolean;
  onMutate: RowMutation;
}) {
  const answer = (outcome: MeetingOutcome) => void onMutate(
    `/records/${recordId}/meeting-outcome`,
    { meetingId: meeting.id, outcome },
    "POST",
     outcome === "showed" ? "Marcado como compareceu" : "Marcado como não compareceu",
  );
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="truncate text-label-sm text-text-strong-950" title={formatMeetingRange(meeting.startAt, meeting.endAt)}>Reunião {formatMeetingRange(meeting.startAt, meeting.endAt)}</p>
      <MeetingOutcomeButtons busy={busy} onAnswer={answer} />
    </div>
  );
}

/** Starting points for feedback; each appends a line so several can be combined. */
const REGENERATE_HINTS: { label: string; text: string }[] = [
  { label: "Mais curto", text: "Resuma em três ou quatro linhas, no máximo." },
  { label: "Menos formal", text: "Menos formal, mais como uma pessoa escrevendo." },
  { label: "Responder à pergunta", text: "Responda à pergunta real deles antes de qualquer coisa." },
  { label: "Menos comercial", text: "Sem tom de venda; apenas seja útil." },
  { label: "Um próximo passo", text: "Proponha um próximo passo concreto." },
];

/**
 * Regenerating with no brief just reruns the same prompt and gets much the
 * same draft back. This asks the reviewer what is wrong or what they want
 * instead; the model then sees both the rejected draft and that note.
 */
export function RegenerateDraftDialog({ open, onOpenChange, onSubmit, busy }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the draft was rewritten; the dialog closes itself then. */
  onSubmit: (feedback: string) => Promise<boolean>;
  busy?: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [working, setWorking] = useState(false);
  useEffect(() => { if (!open) { setFeedback(""); setWorking(false); } }, [open]);
  const ready = feedback.trim().length > 0 && !working && !busy;
  const submit = async () => {
    if (!ready) return;
    setWorking(true);
    const ok = await onSubmit(feedback.trim());
    setWorking(false);
    if (ok) onOpenChange(false);
  };
  const addHint = (hint: string) => setFeedback((current) => current.includes(hint) ? current : [current.trim(), hint].filter(Boolean).join("\n"));
  return (
    // The dialog is portaled, but React still bubbles its clicks up this tree —
    // into a table row whose click opens the record. `contents` keeps the
    // wrapper out of the layout while it swallows those.
    <div className="contents" onClick={(event) => event.stopPropagation()}>
    <Modal.Root open={open} onOpenChange={(next) => { if (!working) onOpenChange(next); }}>
      <Modal.Content size="max-w-lg">
          <Modal.Header icon={RiRefreshLine}>
            <Modal.Title>Regenerar este rascunho</Modal.Title>
            <Modal.Description>Diga à IA o que mudar. Ela reescreve a resposta com suas notas e o rascunho atual.</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            <textarea
              aria-label="O que deve mudar"
              autoFocus
              value={feedback}
              disabled={working}
              onChange={(event) => setFeedback(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void submit(); } }}
              placeholder="Ex.: muito longo e comercial. Eles perguntaram sobre preço — responda isso primeiro e ofereça a ligação de 20 minutos."
              className={cn(fieldClass, "min-h-28 resize-y leading-6")}
            />
          <div className="flex flex-wrap gap-1.5">
            {REGENERATE_HINTS.map((hint) => (
              <button key={hint.label} type="button" disabled={working} onClick={() => addHint(hint.text)} className="rounded-full bg-bg-weak-50 px-2.5 py-1 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200 transition hover:bg-bg-soft-200 hover:text-text-strong-950 disabled:opacity-60">{hint.label}</button>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <span className="mr-auto text-paragraph-xs text-text-sub-600">⌘↵ para regenerar</span>
          <Modal.Close asChild><button type="button" className={secondaryButtonClass} disabled={working}>Cancelar</button></Modal.Close>
          <button type="button" className={primaryButtonClass} disabled={!ready} onClick={() => void submit()}>
            <RiRefreshLine className={cn("size-4", working && "animate-spin")} aria-hidden="true" />{working ? "Reescrevendo…" : "Regenerar"}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
    </div>
  );
}

/** The reason a discard records (crm_records.closed_reason), from every place a rep can discard. */
export const DISCARD_LEAD_REASON = "Descartado pelo operador";
export const DISCARD_LEAD_SUCCESS = "Lead descartado — volta se responderem";

/**
 * Confirms "Discard lead" — one misclick otherwise drops a live lead off the
 * queue and throws away its draft. Discarding closes the record; a new reply
 * reopens it, and the Closed view can reopen it by hand.
 */
export function DiscardLeadDialog({ open, onOpenChange, onConfirm, name }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the lead was discarded; the dialog closes itself then. */
  onConfirm: () => Promise<boolean>;
  /** The lead's name, for the title; omitted reads "this lead". */
  name?: string | null;
}) {
  const [working, setWorking] = useState(false);
  useEffect(() => { if (!open) setWorking(false); }, [open]);
  const confirm = async () => {
    if (working) return;
    setWorking(true);
    const ok = await onConfirm();
    setWorking(false);
    if (ok) onOpenChange(false);
  };
  return (
    // Portaled, but React still bubbles clicks into a table row: swallow them.
    <div className="contents" onClick={(event) => event.stopPropagation()}>
    <Modal.Root open={open} onOpenChange={(next) => { if (!working) onOpenChange(next); }}>
      <Modal.Content size="max-w-md">
        <Modal.Header icon={RiDeleteBinLine}>
          <Modal.Title>Descartar {name?.trim() || "este lead"}?</Modal.Title>
          <Modal.Description>Sai de Ação necessária, o rascunho é descartado e nenhum acompanhamento é enviado. Se responderem de novo, volta automaticamente; você também pode reabri-lo em Fechados.</Modal.Description>
        </Modal.Header>
        <Modal.Footer>
          <Modal.Close asChild><button type="button" className={secondaryButtonClass} disabled={working} autoFocus>Cancelar</button></Modal.Close>
          <button type="button" className={dangerButtonClass} disabled={working} onClick={() => void confirm()}>
            <RiDeleteBinLine className="size-4" aria-hidden="true" />{working ? "Descartando…" : "Descartar lead"}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
    </div>
  );
}

/**
 * "Follow up later": the lead asked to be contacted on a date. Nothing goes
 * out until then, automated follow-ups stop, and the lead returns to Action
 * required that day. The due time is 9:00 on the chosen day in the browser's
 * local time (there is no client-side organization time-zone helper).
 */
export function FollowUpDialog({ open, onOpenChange, onSubmit }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Resolves true when the follow-up was set; the dialog closes itself then.
   * A refusal goes to `onError`, and the dialog stays open showing it — the
   * page's own notice sits behind the dialog's overlay.
   */
  onSubmit: (at: Date, note: string, onError: (message: string) => void) => Promise<boolean>;
}) {
  const [at, setAt] = useState<Date>(() => followUpDueIn(7));
  const [working, setWorking] = useState(false);
  const [note, setNote] = useState("");
  // The days box keeps its own text, so it can be emptied while typing "45"
  // instead of snapping back to the old number.
  const [daysText, setDaysText] = useState("7");
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => { if (open) { setAt(followUpDueIn(7)); setDaysText("7"); setNote(""); setWorking(false); setFailure(null); } }, [open]);
  const error = localizeError(followUpDateError(at));
  const noteError = localizeError(followUpNoteError(note));
  const days = daysBetween(at);
  const pick = (due: Date) => { setAt(due); setDaysText(String(daysBetween(due))); };
  const setDays = (value: string) => {
    setDaysText(value);
    const n = Number(value);
    if (value.trim() && Number.isInteger(n) && n > 0) setAt(followUpDueIn(n));
  };
  const submit = async () => {
    if (error || noteError || working) return;
    setWorking(true);
    setFailure(null);
    const ok = await onSubmit(at, note.trim(), setFailure);
    setWorking(false);
    if (ok) onOpenChange(false);
  };
  return (
    // Portaled, but React still bubbles clicks into a table row: swallow them.
    <div className="contents" onClick={(event) => event.stopPropagation()}>
    <Modal.Root open={open} onOpenChange={(next) => { if (!working) onOpenChange(next); }}>
      <Modal.Content size="max-w-md">
        <Modal.Header icon={RiCalendarScheduleLine}>
          <Modal.Title>Acompanhar depois</Modal.Title>
          <Modal.Description>Nada é enviado até então e os acompanhamentos automáticos param. O lead volta para Ação necessária naquele dia. Se eles escreverem primeiro, volta antes.</Modal.Description>
        </Modal.Header>
        <Modal.Body className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_PRESETS.map((preset) => (
              <button key={preset.label} type="button" disabled={working} onClick={() => pick(followUpDueIn(preset.days))} className={cn("rounded-full px-2.5 py-1 text-label-xs ring-1 ring-inset transition disabled:opacity-60", days === preset.days ? "bg-bg-soft-200 text-text-strong-950 ring-stroke-sub-300" : "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200 hover:bg-bg-soft-200 hover:text-text-strong-950")}>{FOLLOW_UP_PRESET_LABEL_PT[preset.label] ?? preset.label}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-label-xs text-text-sub-600">Em N dias</span>
              <input type="number" min={1} max={MAX_FOLLOW_UP_DAYS} step={1} inputMode="numeric" value={daysText} disabled={working} onChange={(event) => setDays(event.target.value)} className={fieldClass} />
            </label>
            <label className="block space-y-1">
              <span className="text-label-xs text-text-sub-600">Nesta data</span>
              <input type="date" value={toDateInputValue(at)} min={toDateInputValue(followUpDueIn(1))} disabled={working} onChange={(event) => { const due = followUpDueOn(event.target.value); if (due) pick(due); }} className={fieldClass} />
            </label>
          </div>
          <p className={cn("text-paragraph-sm", error ? "text-error-base" : "text-text-sub-600")}>
            {error ?? `Volta para Ação necessária em ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" }).format(at)}.`}
          </p>
          <label className="block space-y-1">
            <span className="text-label-xs text-text-sub-600">Por que depois e o que deve acontecer então?</span>
            <textarea value={note} maxLength={FOLLOW_UP_NOTE_MAX} disabled={working} onChange={(event) => setNote(event.target.value)} placeholder="Disse para falar depois que o orçamento do Q1 estiver definido. Enviar a proposta de preço e pedir uma ligação." className={cn(fieldClass, "min-h-24 resize-y leading-6")} />
            <span className="block text-paragraph-xs text-text-sub-600">A equipe vê isso no registro, e a IA cria o acompanhamento com base nisso naquele dia.</span>
          </label>
          {failure && <p role="alert" className="rounded-lg bg-error-lighter px-3 py-2 text-paragraph-sm text-error-dark">{failure}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Modal.Close asChild><button type="button" className={secondaryButtonClass} disabled={working}>Cancelar</button></Modal.Close>
          <button type="button" className={primaryButtonClass} disabled={Boolean(error) || Boolean(noteError) || working} onClick={() => void submit()}>
            <RiCalendarScheduleLine className="size-4" aria-hidden="true" />{working ? "Salvando…" : "Definir acompanhamento"}
          </button>
        </Modal.Footer>
      </Modal.Content>
    </Modal.Root>
    </div>
  );
}

export function followUpSuccessMessage(at: Date): string {
  return `Acompanhamento definido para ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(at)}. Nada é enviado até então.`;
}

/**
 * The reply composer, trimmed to what an inline row needs: the message being
 * answered on one side, the editable draft on the other, and the same
 * Approve & send / Save / Regenerate / Discard set the record page has.
 */
export function InlineDraftEditor({ action, onMutate, onClose, busy }: { action: Data; onMutate: RowMutation; onClose: () => void; busy: boolean }) {
  const record = asObject(action.record);
  const draft = asObject(action.draft);
  const inbound = asObject(action.latestInbound);
  const policy = asObject(action.contactPolicy);
  const person = asObject(action.person);
  const channel = String(draft.channel ?? action.channel ?? "email");
  const initialBody = String(draft.editedBodyText ?? draft.aiBodyText ?? "");
  const initialSubject = String(draft.subject ?? "");
  const [body, setBody] = useState(initialBody);
  const [subject, setSubject] = useState(initialSubject);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  // A refresh after Save brings a new revision; the fields follow it so the
  // next send carries the revision the server knows about.
  useEffect(() => { setBody(initialBody); setSubject(initialSubject); }, [initialBody, initialSubject]);

  const draftId = String(draft.id ?? "");
  const revision = Number(draft.revision ?? 1);
  const stale = Number(draft.expectedContextVersion) !== Number(record.contextVersion);
  const dnc = Boolean(policy.doNotContact);
  const dirty = body !== initialBody || subject !== initialSubject;
  const ready = Boolean(draftId && body.trim() && (channel !== "email" || subject.trim()) && !dnc && !stale && !busy);
  const requestSubject = channel === "email" ? subject : null;
  const payload = { subject: requestSubject, body, revision };

  const inboundBody = String(inbound.bodyText ?? "").trim();
  const inboundSubject = String(inbound.subject ?? "").trim();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}>
      <div className="min-w-0 rounded-xl bg-bg-weak-50 p-3.5 ring-1 ring-inset ring-stroke-soft-200">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="text-label-xs uppercase tracking-wide text-text-sub-600">Mensagem deles</p>
          <p className="text-paragraph-xs text-text-sub-600">{formatDate(inbound.sentAt ?? record.lastInboundAt)}</p>
        </div>
        {inboundSubject && <p className="mb-1 text-label-sm text-text-strong-950">{inboundSubject}</p>}
        <p className="max-h-64 overflow-y-auto whitespace-pre-wrap text-paragraph-sm leading-6 text-text-sub-600">{inboundBody || "Nenhum texto de mensagem disponível."}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        {dnc && <Warning tone="danger" title="Envio bloqueado" detail="Esta pessoa está marcada como Não contatar." />}
        {stale && !dnc && <Warning tone="warning" title="Este rascunho pode estar desatualizado" detail="Uma resposta mais recente mudou a conversa. Regenere ou abra o registro para revisar antes de enviar." />}
        {channel === "email" && <DraftRecipients draft={draft} personEmail={typeof person.email === "string" ? person.email : null} />}
        {channel === "email" && <input aria-label="Assunto" className={fieldClass} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Assunto do e-mail" disabled={busy} />}
        <textarea
          aria-label="Resposta"
          autoFocus
          className={cn(fieldClass, "min-h-36 resize-y leading-6")}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={`Escreva uma resposta ${channel === "linkedin" ? "no LinkedIn" : channel === "whatsapp" ? "no WhatsApp" : "por e-mail"}…`}
          disabled={busy}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={!ready} className={primaryButtonClass} onClick={() => void onMutate(`/drafts/${draftId}/send`, payload, "POST", "Resposta enfileirada para envio")}>
            <RiSendPlaneLine className="size-4" aria-hidden="true" />{dirty ? "Salvar e enviar" : "Aprovar e enviar"}
          </button>
          <button type="button" disabled={!draftId || !dirty || busy || !body.trim()} className={secondaryButtonClass} onClick={() => void onMutate(`/drafts/${draftId}`, payload, "PATCH", "Rascunho salvo")}>
            <RiSaveLine className="size-4" aria-hidden="true" />Salvar
          </button>
          <button type="button" disabled={!draftId || busy} className={subtleButtonClass} onClick={() => setRegenerateOpen(true)}>
            <RiRefreshLine className="size-4" aria-hidden="true" />Regenerar
          </button>
          <RegenerateDraftDialog open={regenerateOpen} onOpenChange={setRegenerateOpen} busy={busy} onSubmit={(feedback) => onMutate(`/drafts/${draftId}/regenerate`, { feedback }, "POST", "Rascunho reescrito com suas notas")} />
          <button type="button" disabled={!draftId || busy} className={dangerButtonClass} onClick={() => void onMutate(`/drafts/${draftId}/discard`, {}, "POST", "Rascunho descartado")}>
            <RiDeleteBinLine className="size-4" aria-hidden="true" />Descartar
          </button>
          <button type="button" className={cn(subtleButtonClass, "ml-auto")} onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function Warning({ tone, title, detail }: { tone: "warning" | "danger"; title: string; detail: string }) {
  const danger = tone === "danger";
  return <div className={cn("flex gap-2 rounded-lg p-3 ring-1 ring-inset", danger ? "bg-error-lighter text-error-dark ring-error-light" : "bg-warning-lighter text-warning-dark ring-warning-light")}><RiErrorWarningLine className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div><p className="text-label-sm">{title}</p><p className="mt-0.5 text-paragraph-xs">{detail}</p></div></div>;
}
