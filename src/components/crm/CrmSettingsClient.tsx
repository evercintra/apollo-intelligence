"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowGoBackLine,
  RiDeleteBinLine,
  RiEditLine,
  RiMoreLine,
  RiPriceTag3Line,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import * as Table from "@/components/alignui/table";
import * as Textarea from "@/components/alignui/textarea";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { CRM_CATEGORY_COLOR } from "@/components/analytics/theme";
import { BookingLinkField } from "@/components/calling/ai/BookingLinkField";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout, Field } from "@/components/settings/SettingsKit";
import { CategoriesSkeleton } from "@/components/settings/SettingsSkeletons";
import { cn } from "@/utils/cn";
import { useDialogs } from "@/components/DialogProvider";
import { BOOKING_LINK_TOKEN, parseBookingUrl } from "@/lib/crm/bookingLinkToken";
import {
  asList,
  asObject,
  CATEGORY_LABELS,
  crmFetch,
  errorMessage,
} from "./crm-utils";

type Category = Record<string, unknown>;
type Sequence = Record<string, unknown>;
type CategoryKey = "interested" | "not_interested" | "customer" | "other";

const categories: readonly CategoryKey[] = [
  "interested",
  "not_interested",
  "customer",
  "other",
];

function itemId(item: Category) {
  return String(item.id ?? "");
}

function categoryKey(item: Category) {
  return String(item.categoryKey ?? item.category_key ?? "");
}

function classificationDescription(item: Category) {
  return String(item.classificationGuidance ?? item.description ?? "");
}

function sequenceIsAssignable(sequence: Sequence) {
  return sequence.status === "active" && Boolean(
    sequence.latestPublishedVersionId ?? sequence.latest_published_version_id,
  );
}

function localizeBookingError(message: string): string {
  return message
    .replace("The booking link must be text", "O link de agendamento deve ser um texto")
    .replace(/The booking link must be at most (\d+) characters/, "O link de agendamento deve ter no máximo $1 caracteres")
    .replace("The booking link must be a full URL, like https://cal.com/acme/30min", "O link de agendamento deve ser uma URL completa, como https://cal.com/acme/30min")
    .replace("The booking link must start with https:// or http://", "O link de agendamento deve começar com https:// ou http://");
}

/** The pipeline's booking page: what `{{booking_link}}` in a CRM message becomes. */
function BookingLinkSection() {
  const [saved, setSaved] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    let live = true;
    crmFetch<{ bookingUrl?: string | null }>("/settings/booking-link")
      .then((result) => {
        if (!live) return;
        const url = result.bookingUrl ?? null;
        setSaved(url);
        setValue(url ?? "");
        setLoaded(true);
      })
      .catch((cause) => { if (live) { setError(errorMessage(cause)); setLoaded(true); } });
    return () => { live = false; };
  }, []);

  const save = async () => {
    setError("");
    setJustSaved(false);
    const trimmed = value.trim();
    if (trimmed) {
      const parsed = parseBookingUrl(trimmed);
      if (!parsed.ok) { setError(localizeBookingError(parsed.error)); return; }
    }
    setBusy(true);
    try {
      const result = await crmFetch<{ bookingUrl?: string | null }>("/settings/booking-link", {
        method: "PUT",
        body: JSON.stringify({ bookingUrl: trimmed || null }),
      });
      const url = result.bookingUrl ?? null;
      setSaved(url);
      setValue(url ?? "");
      setJustSaved(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const dirty = value.trim() !== (saved ?? "");

  return (
    <Frame>
      <FrameHeader
        title="Link de agendamento"
        description={<>Escreva {BOOKING_LINK_TOKEN} em uma mensagem do CRM (ou deixe a IA incluir) e ele se torna esta página de agendamento com o código do lead, para que a automação registre quando ele agenda. Um link desta página do Cal.com colado manualmente também recebe o código.</>}
      />
      <FramePanel className="space-y-3 p-4 sm:p-4">
        {!loaded ? (
          <p className="text-paragraph-sm text-text-sub-600">Carregando…</p>
        ) : (
          <>
            <BookingLinkField label="Página de agendamento" value={value} onChange={(next) => { setValue(next); setJustSaved(false); }} />
            {!saved && (
              <Callout tone="warning">
                Nenhum link de agendamento foi definido, então mensagens que contêm {BOOKING_LINK_TOKEN} não podem ser enviadas até que ele seja definido.
              </Callout>
            )}
            {error && <Callout tone="error">{error}</Callout>}
            <div className="flex items-center gap-3">
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => void save()} disabled={busy || !dirty}>
                {busy ? "Salvando…" : "Salvar"}
              </Button.Root>
              {justSaved && !error && <span role="status" className="text-paragraph-xs text-success-base">Salvo</span>}
            </div>
          </>
        )}
      </FramePanel>
    </Frame>
  );
}

/** What the add/edit dialog is open for. */
type Editor =
  | { mode: "add"; category: CategoryKey }
  | { mode: "edit"; item: Category };

export default function CrmSettingsClient() {
  const dialogs = useDialogs();
  const [items, setItems] = useState<Category[]>([]);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [pipelineId, setPipelineId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  // Each category is a collapsed section until clicked, so the page reads as
  // four rows rather than one long table.
  const [openCategories, setOpenCategories] = useState<ReadonlySet<CategoryKey>>(() => new Set());
  const toggleCategory = (category: CategoryKey) =>
    setOpenCategories((current) => {
      const next = new Set(current);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  const [busyKey, setBusyKey] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");
    try {
      const [categoryResult, sequenceResult] = await Promise.all([
        crmFetch("/categories"),
        crmFetch("/sequences?includeArchived=true"),
      ]);
      const config = asObject(categoryResult);
      setPipelineId(String(config.pipelineId ?? ""));
      setItems(
        asList<Category>(config.categories).flatMap((category) =>
          asList<Category>(category.subcategories).map((item) => ({
            ...item,
            categoryKey: item.categoryKey ?? category.key,
          })),
        ),
      );
      setSequences(asList(sequenceResult, ["sequences"]));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openAdd = (category: CategoryKey) => {
    setOpenCategories((current) => new Set(current).add(category));
    setEditor({ mode: "add", category });
    setError("");
  };

  /**
   * Creates or updates a subcategory. Returns an error for the dialog to show,
   * or null once saved. Empty stage means "not a funnel stage" (stageRank:
   * null), the same as a subcategory like Out of Office that the AI should
   * never treat as forward progress.
   */
  const submit = async (values: { name: string; description: string; stageRank: string }): Promise<string | null> => {
    if (!editor) return null;
    const description = values.description.trim() || null;
    const stageRank = values.stageRank.trim() ? Number(values.stageRank) : null;
    try {
      if (editor.mode === "add") {
        if (!pipelineId) return "Nenhum pipeline padrão do CRM foi configurado ainda.";
        setBusyKey(`create:${editor.category}`);
        await crmFetch("/subcategories", {
          method: "POST",
          body: JSON.stringify({
            pipelineId,
            categoryKey: editor.category,
            name: values.name.trim(),
            description,
            classificationGuidance: description,
            reviewRequired: false,
            sortOrder: 0,
            stageRank,
          }),
        });
      } else {
        const id = itemId(editor.item);
        setBusyKey(`edit:${id}`);
        await crmFetch(`/subcategories/${id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: values.name.trim(),
            classificationGuidance: description,
            stageRank,
          }),
        });
      }
      setEditor(null);
      await load(false);
      return null;
    } catch (cause) {
      return errorMessage(cause);
    } finally {
      setBusyKey("");
    }
  };

  const setActive = async (item: Category, active: boolean) => {
    const id = itemId(item);
    setBusyKey(`active:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active }),
      });
      await load(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const remove = async (item: Category) => {
    const id = itemId(item);
    if (!id) return;
    const name = String(item.name ?? "esta subcategoria");
    const confirmed = await dialogs.confirm({
      title: "Excluir subcategoria?",
      description: `“${name}” será excluída permanentemente junto com sua sequência atribuída. Subcategorias que ainda têm registros do CRM ou histórico de classificação não podem ser excluídas.`,
      confirmLabel: "Excluir subcategoria",
      variant: "error",
    });
    if (!confirmed) return;
    setBusyKey(`delete:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}`, { method: "DELETE" });
      await load(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const assign = async (item: Category, sequenceId: string) => {
    const id = itemId(item);
    setBusyKey(`sequence:${id}`);
    setError("");
    try {
      await crmFetch(`/subcategories/${id}/sequence`, {
        method: "PUT",
        body: JSON.stringify({ sequenceId: sequenceId || null }),
      });
      setItems((current) => current.map((entry) =>
        itemId(entry) === id ? { ...entry, sequenceId: sequenceId || null } : entry,
      ));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const allOpen = categories.every((c) => openCategories.has(c));

  return (
    <div className="space-y-4">
      <BookingLinkSection />
      {error && (
        <Callout
          tone="error"
          action={<Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>Tentar novamente</Button.Root>}
        >
          {error}
        </Callout>
      )}
      {!pipelineId && !loading && !error && (
        <Callout tone="warning" title="Ainda não há pipeline no CRM">
          As subcategorias pertencem ao pipeline padrão do CRM, e nenhum foi configurado ainda.
        </Callout>
      )}

      {loading ? (
        <CategoriesSkeleton />
      ) : error && items.length === 0 ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-paragraph-xs text-text-sub-600">
              {items.filter((i) => i.active !== false).length} subcategorias ativas em {categories.length} categorias
            </p>
            <Button.Root
              variant="neutral"
              mode="ghost"
              size="xsmall"
              onClick={() => setOpenCategories(allOpen ? new Set() : new Set(categories))}
            >
              {allOpen ? "Recolher todas" : "Expandir todas"}
            </Button.Root>
          </div>
          {categories.map((category) => (
            <CategorySection
              key={category}
              category={category}
              items={items.filter((item) => categoryKey(item) === category)}
              sequences={sequences}
              pipelineReady={Boolean(pipelineId)}
              open={openCategories.has(category)}
              onToggle={() => toggleCategory(category)}
              busyKey={busyKey}
              onAdd={() => openAdd(category)}
              onEdit={(item) => setEditor({ mode: "edit", item })}
              onSetActive={setActive}
              onDelete={remove}
              onAssign={assign}
            />
          ))}
        </>
      )}

      {editor && (
        <SubcategoryDialog
          key={editor.mode === "add" ? `add:${editor.category}` : `edit:${itemId(editor.item)}`}
          editor={editor}
          busy={Boolean(busyKey)}
          onClose={() => setEditor(null)}
          onSubmit={submit}
        />
      )}
    </div>
  );
}

function CategorySection({
  category,
  items,
  sequences,
  pipelineReady,
  open,
  onToggle,
  busyKey,
  onAdd,
  onEdit,
  onSetActive,
  onDelete,
  onAssign,
}: {
  category: CategoryKey;
  items: Category[];
  sequences: Sequence[];
  pipelineReady: boolean;
  open: boolean;
  onToggle: () => void;
  busyKey: string;
  onAdd: () => void;
  onEdit: (item: Category) => void;
  onSetActive: (item: Category, active: boolean) => Promise<void>;
  onDelete: (item: Category) => Promise<void>;
  onAssign: (item: Category, sequenceId: string) => Promise<void>;
}) {
  const activeCount = items.filter((item) => item.active !== false).length;
  const archivedCount = items.length - activeCount;
  const withSequence = items.filter((item) => item.active !== false && (item.sequenceId ?? item.sequence_id)).length;
  const panelId = `crm-category-${category}`;

  return (
    <Frame>
      <div className="flex items-center gap-2 py-1 pl-1 pr-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left outline-none transition hover:bg-bg-white-0 focus-visible:ring-2 focus-visible:ring-primary-base"
        >
          <RiArrowDownSLine
            aria-hidden="true"
            className={cn("size-5 shrink-0 text-text-sub-600 transition-transform duration-200", !open && "-rotate-90")}
          />
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: CRM_CATEGORY_COLOR[category] }} />
          <span className="min-w-0">
            <span className="block text-label-sm text-text-strong-950">{CATEGORY_LABELS[category]}</span>
            <span className="block truncate text-paragraph-xs text-text-sub-600">
              {activeCount} {activeCount === 1 ? "subcategoria ativa" : "subcategorias ativas"}
              {activeCount > 0 && ` · ${withSequence} com sequência`}
              {archivedCount > 0 && ` · ${archivedCount} arquivadas`}
            </span>
          </span>
        </button>
        <Button.Root
          variant="neutral"
          mode="stroke"
          size="xsmall"
          className="shrink-0"
          disabled={!pipelineReady || Boolean(busyKey)}
          onClick={onAdd}
          aria-label={`Adicionar subcategoria ${CATEGORY_LABELS[category]}`}
        >
          <Button.Icon as={RiAddLine} />
          <span className="hidden sm:inline">Adicionar subcategoria</span>
          <span className="sm:hidden">Adicionar</span>
        </Button.Root>
      </div>

      {open && (
        <FramePanel id={panelId} className="overflow-x-auto p-2 sm:p-2">
          {items.length === 0 ? (
            <EmptyState
              compact
              icon={RiPriceTag3Line}
              title={`Ainda não há subcategorias de ${CATEGORY_LABELS[category].toLowerCase()}`}
              description="Adicione uma para definir como as respostas são classificadas e qual sequência vem depois."
            />
          ) : (
            <Table.Root className="min-w-180 [&>table]:table-fixed">
              <caption className="sr-only">Subcategorias de {CATEGORY_LABELS[category]} e suas sequências</caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head scope="col" className="w-[28%] px-4">Subcategoria</Table.Head>
                  <Table.Head scope="col" className="px-4">Descrição da classificação</Table.Head>
                  <Table.Head scope="col" className="w-60 px-4">Sequência</Table.Head>
                  <Table.Head scope="col" className="w-14 px-4"><span className="sr-only">Ações</span></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body spacing={4}>
                {items.map((item) => (
                  <SubcategoryRow
                    key={itemId(item)}
                    item={item}
                    sequences={sequences}
                    busyKey={busyKey}
                    onEdit={onEdit}
                    onSetActive={onSetActive}
                    onDelete={onDelete}
                    onAssign={onAssign}
                  />
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </FramePanel>
      )}
    </Frame>
  );
}

function SubcategoryRow({
  item,
  sequences,
  busyKey,
  onEdit,
  onSetActive,
  onDelete,
  onAssign,
}: {
  item: Category;
  sequences: Sequence[];
  busyKey: string;
  onEdit: (item: Category) => void;
  onSetActive: (item: Category, active: boolean) => Promise<void>;
  onDelete: (item: Category) => Promise<void>;
  onAssign: (item: Category, sequenceId: string) => Promise<void>;
}) {
  const id = itemId(item);
  const archived = item.active === false;
  const sequenceId = String(item.sequenceId ?? item.sequence_id ?? "");
  const stageRank = item.stageRank == null ? null : Number(item.stageRank);
  const description = classificationDescription(item);
  const name = String(item.name ?? "Sem nome");
  const records = Number(item.activeRecordCount ?? item.recordCount ?? 0);
  const busy = busyKey.endsWith(`:${id}`);

  return (
    <Table.Row className={cn(busy && "opacity-60")} aria-busy={busy || undefined}>
      <Table.Cell className="px-4 py-3 align-top">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className={cn("truncate text-label-sm", archived ? "text-text-sub-600" : "text-text-strong-950")} title={name}>{name}</span>
          {archived && <Badge.Root size="small" variant="lighter" color="gray">Arquivada</Badge.Root>}
        </div>
        <p className="mt-1 text-paragraph-xs text-text-sub-600">
          {records.toLocaleString("pt-BR")} {records === 1 ? "registro ativo" : "registros ativos"} · {stageRank != null ? `Estágio ${stageRank}` : "Não é estágio do funil"}
        </p>
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        {description ? (
          <p className="line-clamp-2 text-paragraph-sm text-text-sub-600" title={description}>{description}</p>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(item)}
            disabled={Boolean(busyKey)}
            className="rounded text-paragraph-sm text-text-sub-600 underline decoration-dotted underline-offset-2 outline-none transition hover:text-text-strong-950 focus-visible:ring-2 focus-visible:ring-primary-base"
          >
            Adicione uma descrição para a IA saber quando usar
          </button>
        )}
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        <SequenceDropdown
          value={sequenceId}
          sequences={sequences}
          disabled={archived || Boolean(busyKey)}
          onChange={(value) => void onAssign(item, value)}
        />
      </Table.Cell>
      <Table.Cell className="px-4 py-3 align-top">
        <div className="flex justify-end">
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={Boolean(busyKey)} aria-label={`Ações para ${name}`}>
                <Button.Icon as={RiMoreLine} />
              </Button.Root>
            </Dropdown.Trigger>
            <Dropdown.Content align="end" className="min-w-40">
              <Dropdown.Item onSelect={() => onEdit(item)}>
                <Dropdown.ItemIcon as={RiEditLine} />
                Editar
              </Dropdown.Item>
              {/* Archiving is gone, but rows archived before it was removed
                  would otherwise have no way back. */}
              {archived && (
                <Dropdown.Item onSelect={() => void onSetActive(item, true)}>
                  <Dropdown.ItemIcon as={RiArrowGoBackLine} />
                  Restaurar
                </Dropdown.Item>
              )}
              <Dropdown.Separator />
              <Dropdown.Item destructive onSelect={() => void onDelete(item)}>
                <Dropdown.ItemIcon as={RiDeleteBinLine} />
                Excluir
              </Dropdown.Item>
            </Dropdown.Content>
          </Dropdown.Root>
        </div>
      </Table.Cell>
    </Table.Row>
  );
}

function SequenceDropdown({
  value,
  sequences,
  disabled,
  onChange,
}: {
  value: string;
  sequences: Sequence[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const options = useMemo(() => {
    if (value && !sequences.some((sequence) => String(sequence.id) === value)) {
      return [{ id: value, name: "Sequência indisponível", status: "archived" }, ...sequences];
    }
    return sequences;
  }, [sequences, value]);

  return (
    <Select.Root size="xsmall" value={value} disabled={disabled} onValueChange={onChange}>
      <Select.Trigger aria-label="Sequência" className="w-full"><Select.Value /></Select.Trigger>
      <Select.Content>
        <Select.Item value="">Sem sequência</Select.Item>
        {options.map((sequence) => {
          const assignable = sequenceIsAssignable(sequence);
          const suffix = sequence.status !== "active"
            ? " — arquivada"
            : assignable
              ? ""
              : " — publicar primeiro";
          return (
            <Select.Item
              key={String(sequence.id)}
              value={String(sequence.id)}
              disabled={!assignable && String(sequence.id) !== value}
            >
              {String(sequence.name ?? "Sequência sem nome")}{suffix}
            </Select.Item>
          );
        })}
      </Select.Content>
    </Select.Root>
  );
}

/** Add or edit one subcategory: its name, when the AI should use it, and its funnel stage. */
function SubcategoryDialog({
  editor,
  busy,
  onClose,
  onSubmit,
}: {
  editor: Editor;
  busy: boolean;
  onClose: () => void;
  onSubmit: (values: { name: string; description: string; stageRank: string }) => Promise<string | null>;
}) {
  const item = editor.mode === "edit" ? editor.item : null;
  const category = (editor.mode === "add" ? editor.category : categoryKey(editor.item)) as CategoryKey;
  const [name, setName] = useState(item ? String(item.name ?? "") : "");
  const [description, setDescription] = useState(item ? classificationDescription(item) : "");
  const [stageRank, setStageRank] = useState(item && item.stageRank != null ? String(item.stageRank) : "");
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const nameMissing = touched && !name.trim();
  const stageInvalid = stageRank.trim() !== "" && (!Number.isInteger(Number(stageRank)) || Number(stageRank) < 1);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!name.trim() || stageInvalid) return;
    setError(null);
    const problem = await onSubmit({ name, description, stageRank });
    if (problem) setError(problem);
  };

  return (
    <Modal.Root open onOpenChange={(open) => !open && !busy && onClose()}>
      <Modal.Content size="max-w-lg">
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <Modal.Header icon={RiPriceTag3Line}>
            <Modal.Title>{item ? "Editar subcategoria" : "Adicionar subcategoria"}</Modal.Title>
            <Modal.Description>
              Em <span className="text-text-strong-950">{CATEGORY_LABELS[category] ?? category}</span>. A IA usa a descrição para classificar as respostas aqui.
            </Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <Field label="Nome" htmlFor="subcategory-name" required error={nameMissing ? "Dê um nome à subcategoria." : undefined}>
              <Input.Root size="small" hasError={nameMissing}>
                <Input.Wrapper>
                  <Input.Input id="subcategory-name" autoFocus maxLength={120} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Demonstração solicitada" />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field
              label="Descrição da classificação"
              htmlFor="subcategory-description"
              optional
              description="Explique quando uma resposta recebida deve ser colocada aqui."
            >
              <Textarea.Root
                id="subcategory-description"
                simple
                maxLength={2000}
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ex.: a pessoa pede explicitamente uma demonstração do produto"
                className="resize-y"
              />
            </Field>
            <Field
              label="Estágio do funil"
              htmlFor="subcategory-stage"
              optional
              error={stageInvalid ? "Use um número inteiro a partir de 1 ou deixe vazio." : undefined}
              description="A IA só pode mover um lead para o mesmo estágio ou um superior. Deixe vazio para resultados que não são estágios do funil (Fora do escritório, Não interessado)."
            >
              <Input.Root size="small" className="w-32" hasError={stageInvalid}>
                <Input.Wrapper>
                  <Input.Input id="subcategory-stage" type="number" min={1} step={1} value={stageRank} onChange={(event) => setStageRank(event.target.value)} placeholder="Ex.: 2" />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            {error && <Callout tone="error">{error}</Callout>}
          </Modal.Body>
          <Modal.Footer>
            <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={busy} onClick={onClose}>
              Cancelar
            </Button.Root>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy}>
              {busy ? (item ? "Salvando…" : "Adicionando…") : item ? "Salvar alterações" : "Adicionar subcategoria"}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
