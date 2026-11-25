"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiAddLine,
  RiDeleteBinLine,
  RiEditLine,
  RiGitBranchLine,
  RiLoopLeftLine,
  RiMoreLine,
  RiPriceTag3Line,
  RiSearchLine,
  RiSendPlaneLine,
} from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Input from "@/components/alignui/input";
import * as Modal from "@/components/alignui/modal";
import * as SegmentedControl from "@/components/alignui/segmented-control";
import * as Switch from "@/components/alignui/switch";
import * as Table from "@/components/alignui/table";
import { Frame, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { useDialogs } from "@/components/DialogProvider";
import { EmptyState } from "@/components/page/EmptyState";
import { PageHeader } from "@/components/page/PageHeader";
import { cn } from "@/utils/cn";
import { categoryToneClass } from "./ActionRowTools";
import { ErrorState, fieldClass } from "./CrmLayout";
import { RowsSkeleton } from "./CrmSkeletons";
import { asList, asObject, CATEGORY_LABELS, crmFetch, errorMessage, timeAgo } from "./crm-utils";

type Sequence = Record<string, unknown>;
type SubcategoryReference = { name: string; categoryKey: string };

const DEFAULT_IMMEDIATE_GOAL = "Responda à última mensagem recebida e faça a conversa avançar naturalmente.";

type Status = "published" | "draft" | "archived";
const STATUS_META: Record<Status, { label: string; color: React.ComponentProps<typeof Badge.Root>["color"] }> = {
  published: { label: "Publicada", color: "green" },
  draft: { label: "Rascunho", color: "gray" },
  archived: { label: "Arquivada", color: "orange" },
};
const TABS = ["all", "published", "draft", "archived"] as const;
type Tab = (typeof TABS)[number];

function sequenceStatus(sequence: Sequence): Status {
  if (sequence.status === "archived") return "archived";
  return sequence.latestPublishedVersionId ?? sequence.latestPublishedVersion ? "published" : "draft";
}

function categoryLabel(key: string) {
  return CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS] ?? key;
}

export default function CrmSequencesClient() {
  const router = useRouter();
  const dialogs = useDialogs();
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [subcategoryById, setSubcategoryById] = useState<Record<string, SubcategoryReference>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  // Read once, so the "updated 3d ago" lines stay pure during render.
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [sequenceResult, categoryResult] = await Promise.all([
        crmFetch("/sequences?includeArchived=true"),
        crmFetch("/categories"),
      ]);
      setSequences(asList(sequenceResult, ["sequences"]));
      const categories = asList<Record<string, unknown>>(asObject(categoryResult).categories);
      const references: Record<string, SubcategoryReference> = {};
      for (const category of categories) {
        for (const subcategory of asList<Record<string, unknown>>(category.subcategories)) {
          references[String(subcategory.id)] = {
            name: String(subcategory.name ?? "Subcategoria sem nome"),
            categoryKey: String(subcategory.categoryKey ?? category.key ?? "other"),
          };
        }
      }
      setSubcategoryById(references);
      setLoaded(true);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (body: Record<string, unknown>) => {
    setBusyKey("create");
    setError("");
    try {
      const result = asObject(await crmFetch("/sequences", {
        method: "POST",
        body: JSON.stringify(body),
      }));
      const id = asObject(result.sequence).id;
      if (!id) throw new Error("A nova sequência não retornou um ID");
      router.push(`/crm/sequences/${String(id)}`);
    } catch (cause) {
      setError(errorMessage(cause));
      setShowCreate(false);
      setBusyKey("");
    }
  };

  const remove = async (sequence: Sequence) => {
    const id = String(sequence.id);
    const name = String(sequence.name ?? "Sequência sem nome");
    const assignmentCount = asList<string>(sequence.assignedSubcategoryIds).length;
    const confirmed = await dialogs.confirm({
      title: "Excluir sequência?",
      description: assignmentCount
        ? `“${name}” será excluída permanentemente e removida de ${assignmentCount} ${assignmentCount === 1 ? "subcategoria" : "subcategorias"}. Sequências com histórico de atividades no CRM não podem ser excluídas.`
        : `“${name}” será excluída permanentemente. Isso não pode ser desfeito. Sequências com histórico de atividades no CRM não podem ser excluídas.`,
      confirmLabel: "Excluir sequência",
      variant: "error",
    });
    if (!confirmed) return;

    setBusyKey(`delete:${id}`);
    setError("");
    try {
      await crmFetch(`/sequences/${id}`, {
        method: "DELETE",
      });
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  // Not versioned: applies at once, no publish. Turning it off moves any
  // follow-ups already waiting to send into Action required (server side).
  const toggleAutoSend = async (sequence: Sequence, value: boolean) => {
    const id = String(sequence.id);
    setBusyKey(`auto:${id}`);
    setError("");
    setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendFollowUps: value } : row));
    try {
      await crmFetch(`/sequences/${id}`, { method: "PATCH", body: JSON.stringify({ autoSendFollowUps: value }) });
    } catch (cause) {
      setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendFollowUps: !value } : row));
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const toggleAutoSendReply = async (sequence: Sequence, value: boolean) => {
    const id = String(sequence.id);
    setBusyKey(`auto-reply:${id}`);
    setError("");
    setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendReply: value } : row));
    try {
      await crmFetch(`/sequences/${id}`, { method: "PATCH", body: JSON.stringify({ autoSendReply: value }) });
    } catch (cause) {
      setSequences((current) => current.map((row) => String(row.id) === id ? { ...row, autoSendReply: !value } : row));
      setError(errorMessage(cause));
    } finally {
      setBusyKey("");
    }
  };

  const counts = useMemo(() => {
    const byStatus: Record<Tab, number> = { all: sequences.length, published: 0, draft: 0, archived: 0 };
    for (const sequence of sequences) byStatus[sequenceStatus(sequence)] += 1;
    return byStatus;
  }, [sequences]);
  const inUse = sequences.filter((sequence) => sequence.status !== "archived" && asList(sequence.assignedSubcategoryIds).length > 0).length;
  const covered = new Set(sequences.flatMap((sequence) => asList<string>(sequence.assignedSubcategoryIds))).size;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sequences.filter((sequence) => {
      if (tab !== "all" && sequenceStatus(sequence) !== tab) return false;
      if (term && !`${String(sequence.name ?? "")} ${String(sequence.description ?? "")}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [sequences, tab, search]);
  const open = (id: string) => router.push(`/crm/sequences/${id}`);

  return (
    <>
      <PageHeader
        title="Sequências"
        description="Fluxos de resposta reutilizáveis para subcategorias do CRM. A resposta imediata espera por você, a menos que a sequência a envie após 15 minutos; com Envio automático ligado, os acompanhamentos se enviam sozinhos."
        actions={
          <Button.Root variant="primary" mode="filled" size="small" disabled={Boolean(busyKey)} onClick={() => setShowCreate(true)}>
            <Button.Icon as={RiAddLine} />
            Criar sequência
          </Button.Root>
        }
      />

      <KpiStrip className="mt-6" columns={3}>
        <KpiCell icon={RiSendPlaneLine} label="Publicadas" value={loaded ? counts.published.toLocaleString("pt-BR") : "—"} context={loaded ? `${counts.draft} rascunho · ${counts.archived} arquivada` : undefined} hint="Só a versão publicada é executada. Editar uma sequência altera o rascunho até você publicar de novo." />
        <KpiCell icon={RiGitBranchLine} label="Em uso" value={loaded ? inUse.toLocaleString("pt-BR") : "—"} context={loaded ? `Atribuída a ${covered} ${covered === 1 ? "subcategoria" : "subcategorias"}` : undefined} hint="Sequências atribuídas a pelo menos uma subcategoria nas Configurações do CRM. Uma resposta classificada nela inicia a sequência." />
        <KpiCell icon={RiLoopLeftLine} label="Não atribuídas" value={loaded ? Math.max(counts.all - counts.archived - inUse, 0).toLocaleString("pt-BR") : "—"} context="Criadas, mas não iniciadas por nenhuma subcategoria" />
      </KpiStrip>

      {error && <div className="mt-5"><ErrorState message={error} onRetry={() => void load()} /></div>}

      <Frame className="mt-5">
        <FrameHeader
          title="Biblioteca de sequências"
          description="Crie uma vez, publique uma versão e atribua às subcategorias nas Configurações do CRM."
          actions={<>
            <SegmentedControl.Root value={tab} onValueChange={(value) => setTab(value as Tab)} className="w-full sm:w-auto">
              <SegmentedControl.List className="w-full sm:w-auto">
                {TABS.map((value) => (
                  <SegmentedControl.Trigger key={value} value={value} className="gap-1 px-1.5 text-label-xs sm:gap-1.5 sm:px-3 sm:text-label-sm">
                    {value === "all" ? "Todas" : STATUS_META[value].label}
                    <span className="tabular-nums text-text-sub-600">{counts[value]}</span>
                  </SegmentedControl.Trigger>
                ))}
              </SegmentedControl.List>
            </SegmentedControl.Root>
            <Input.Root size="small" className="w-full sm:w-56">
              <Input.Wrapper>
                <Input.Icon as={RiSearchLine} />
                <Input.Input type="search" aria-label="Buscar sequências" placeholder="Buscar sequências…" value={search} onChange={(event) => setSearch(event.target.value)} />
              </Input.Wrapper>
            </Input.Root>
          </>}
        />
        <FramePanel className="overflow-hidden p-0 sm:p-0">
          {!loaded && loading ? <RowsSkeleton rows={5} />
            : filtered.length === 0 ? (
              sequences.length === 0
                ? <EmptyState icon={RiLoopLeftLine} title="Ainda não há sequências" description="Crie uma sequência, adicione as etapas de acompanhamento, publique-a e atribua nas Configurações do CRM." action={<Button.Root variant="primary" mode="filled" size="small" onClick={() => setShowCreate(true)}><Button.Icon as={RiAddLine} />Criar sequência</Button.Root>} />
                : <EmptyState icon={RiSearchLine} title="Nenhuma sequência encontrada" description="Tente outro status ou busca." />
            ) : (
              <div aria-busy={loading || undefined} className={cn("overflow-x-auto p-2 transition-opacity", loading && "opacity-60")}>
                <Table.Root className="min-w-[980px]" style={{ tableLayout: "fixed" }}>
                  <caption className="sr-only">Biblioteca de sequências do CRM</caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head scope="col" className="w-[27%] px-4">Sequência</Table.Head>
                      <Table.Head scope="col" className="w-[18%] px-4">Etapas</Table.Head>
                      <Table.Head scope="col" className="w-[25%] px-4">Usada para</Table.Head>
                      <Table.Head scope="col" className="w-[15%] px-4" title="Os acompanhamentos criados pela IA se enviam sozinhos, um por conta a cada 30 minutos, dentro do horário de envio. A segunda chave envia também a resposta imediata, após 15 minutos.">Envio automático</Table.Head>
                      <Table.Head scope="col" className="w-[12%] px-4">Status</Table.Head>
                      <Table.Head scope="col" className="w-14 px-2"><span className="sr-only">Ações</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body spacing={4}>
                    {filtered.map((sequence, index) => (
                      <SequenceRow
                        key={String(sequence.id ?? index)}
                        sequence={sequence}
                        subcategoryById={subcategoryById}
                        busy={Boolean(busyKey)}
                        now={now}
                        onOpen={open}
                        onDelete={remove}
                        onToggleAutoSend={toggleAutoSend}
                        onToggleAutoSendReply={toggleAutoSendReply}
                      />
                    ))}
                  </Table.Body>
                </Table.Root>
              </div>
            )}
        </FramePanel>
      </Frame>

      <CreateSequence
        open={showCreate}
        busy={busyKey === "create"}
        onOpenChange={setShowCreate}
        onCreate={create}
      />
    </>
  );
}

function SequenceRow({
  sequence,
  subcategoryById,
  busy,
  now,
  onOpen,
  onDelete,
  onToggleAutoSend,
  onToggleAutoSendReply,
}: {
  sequence: Sequence;
  subcategoryById: Record<string, SubcategoryReference>;
  busy: boolean;
  now: number;
  onOpen: (id: string) => void;
  onDelete: (sequence: Sequence) => Promise<void>;
  onToggleAutoSend: (sequence: Sequence, value: boolean) => Promise<void>;
  onToggleAutoSendReply: (sequence: Sequence, value: boolean) => Promise<void>;
}) {
  const id = String(sequence.id);
  const name = String(sequence.name ?? "Sequência sem nome");
  const steps = Number(sequence.draftStepCount ?? sequence.stepCount ?? 0);
  const status = sequenceStatus(sequence);
  const archived = status === "archived";
  const version = sequence.latestPublishedVersion ? `v${String(sequence.latestPublishedVersion)}` : "";
  const updated = sequence.updatedAt ? ago(sequence.updatedAt, now) : "";
  const assignments = asList<string>(sequence.assignedSubcategoryIds)
    .map((subcategoryId) => subcategoryById[String(subcategoryId)])
    .filter((value): value is SubcategoryReference => Boolean(value));
  const autoSend = sequence.autoSendFollowUps === true;
  const autoSendReply = sequence.autoSendReply === true;
  const visible = assignments.slice(0, 3);
  const hidden = assignments.slice(3);

  return (
    <Table.Row
      tabIndex={0}
      className={cn("cursor-pointer outline-none focus-visible:[&>td]:bg-bg-weak-50", archived && "[&_td]:text-text-sub-600")}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button, [role='menuitem']")) return;
        onOpen(id);
      }}
      onKeyDown={(event) => { if (event.target === event.currentTarget && event.key === "Enter") onOpen(id); }}
    >
      <Table.Cell className="px-4 py-3">
        <div className="min-w-0">
          <Link href={`/crm/sequences/${id}`} className={cn("block truncate text-label-sm hover:text-primary-base", archived ? "text-text-sub-600" : "text-text-strong-950")} title={name}>{name}</Link>
          <p className="mt-0.5 truncate text-paragraph-xs text-text-sub-600" title={sequence.description ? String(sequence.description) : undefined}>
            {sequence.description ? String(sequence.description) : updated ? `Atualizada ${updated}` : "Sem descrição"}
          </p>
        </div>
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        <StepSummary steps={steps} />
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        {assignments.length ? (
          <div className="flex flex-wrap gap-1.5">
            {visible.map((assignment) => (
              <span
                key={`${assignment.categoryKey}:${assignment.name}`}
                title={`${categoryLabel(assignment.categoryKey)} · ${assignment.name}`}
                className={cn("inline-flex h-6 max-w-full items-center rounded-md px-2 text-label-xs ring-1 ring-inset", categoryToneClass[assignment.categoryKey] ?? "bg-bg-weak-50 text-text-sub-600 ring-stroke-soft-200")}
              >
                <span className="truncate">{assignment.name}</span>
              </span>
            ))}
            {hidden.length > 0 && (
              <span title={hidden.map((item) => `${categoryLabel(item.categoryKey)} · ${item.name}`).join("\n")} className="inline-flex h-6 items-center rounded-md bg-bg-weak-50 px-2 text-label-xs text-text-sub-600 ring-1 ring-inset ring-stroke-soft-200">
                +{hidden.length} a mais
              </span>
            )}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-paragraph-xs text-text-sub-600"><RiPriceTag3Line className="size-3.5" aria-hidden="true" />Não atribuída</span>
        )}
      </Table.Cell>
      <Table.Cell className="px-4 py-3" onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <Switch.Root
            checked={autoSend}
            disabled={busy || archived}
            onCheckedChange={(value) => void onToggleAutoSend(sequence, value)}
            aria-label={`Enviar acompanhamentos de ${name} automaticamente`}
          />
          <span className={cn("text-label-sm", autoSend ? "text-text-strong-950" : "text-text-sub-600")}>{autoSend ? "Ligado" : "Desligado"}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Switch.Root
            checked={autoSendReply}
            disabled={busy || archived}
            onCheckedChange={(value) => void onToggleAutoSendReply(sequence, value)}
            aria-label={`Enviar resposta imediata de ${name} automaticamente`}
          />
          <span className={cn("text-paragraph-xs", autoSendReply ? "text-text-strong-950" : "text-text-sub-600")}>{autoSendReply ? "Resposta após 15 min" : "Resposta espera por você"}</span>
        </div>
        <p className="mt-1 truncate text-paragraph-xs text-text-sub-600">
          {archived ? "Arquivada" : steps <= 1 ? "Sem acompanhamentos" : autoSend ? "Envia sozinha" : "Espera por você"}
        </p>
      </Table.Cell>
      <Table.Cell className="px-4 py-3">
        <Badge.Root variant="lighter" size="medium" color={STATUS_META[status].color}>
          <Badge.Dot />{STATUS_META[status].label}
        </Badge.Root>
        <p className="mt-1 truncate text-paragraph-xs text-text-sub-600">{status === "published" ? `${version || "Mais recente"} ativa` : status === "draft" ? "Ainda não publicada" : updated ? `Arquivada · atualizada ${updated}` : "Arquivada"}</p>
      </Table.Cell>
      <Table.Cell className="px-2 py-3" onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={`Ações para ${name}`}>
                <Button.Icon as={RiMoreLine} />
              </Button.Root>
            </Dropdown.Trigger>
            <Dropdown.Content align="end" className="min-w-[160px]">
              <Dropdown.Item asChild>
                <Link href={`/crm/sequences/${id}`}>
                  <Dropdown.ItemIcon as={RiEditLine} />
                  Editar
                </Link>
              </Dropdown.Item>
              <Dropdown.Separator />
              <Dropdown.Item destructive onSelect={() => void onDelete(sequence)}>
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

/** "3d ago" for a timestamp, against a clock read once per page. */
function ago(value: unknown, now: number) {
  const time = new Date(String(value)).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.round((now - time) / 60_000);
  if (minutes < 60 * 24 * 30) return timeAgo(value);
  return new Date(time).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * The shape of the sequence at a glance: the immediate reply, then one tick
 * per follow-up, with the count spelled out — "Reply + 3 follow-ups".
 */
function StepSummary({ steps }: { steps: number }) {
  if (steps === 0) return <span className="text-paragraph-xs text-text-sub-600">Ainda sem etapas</span>;
  const followUps = Math.max(steps - 1, 0);
  return (
    <div className="min-w-0">
      <p className="text-label-sm tabular-nums text-text-strong-950">{steps} {steps === 1 ? "etapa" : "etapas"}</p>
      <div className="mt-1 flex items-center gap-2">
        <span aria-hidden="true" className="flex shrink-0 gap-0.5">
          <span className="h-1.5 w-4 rounded-full bg-primary-base" />
          {Array.from({ length: Math.min(followUps, 8) }, (_, index) => <span key={index} className="h-1.5 w-2.5 rounded-full bg-bg-soft-200" />)}
        </span>
        <span className="truncate text-paragraph-xs text-text-sub-600">{followUps ? `Resposta + ${followUps} ${followUps === 1 ? "acompanhamento" : "acompanhamentos"}` : "Só resposta"}</span>
      </div>
    </div>
  );
}

function CreateSequence({
  open,
  busy,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => { if (!open) { setName(""); setDescription(""); } }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    void onCreate({
      name: name.trim(),
      description: description.trim() || null,
      steps: [{
        name: "Resposta imediata",
        delayMinutes: 0,
        subjectTemplate: null,
        bodyTemplate: null,
        aiInstructions: DEFAULT_IMMEDIATE_GOAL,
        knowledgeTags: [],
      }],
    });
  };

  return (
    <Modal.Root open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <Modal.Content size="max-w-lg">
        <form onSubmit={submit}>
          <Modal.Header icon={RiLoopLeftLine}>
            <Modal.Title>Nova sequência</Modal.Title>
            <Modal.Description>Preencha o básico agora e ajuste as etapas da mensagem na próxima tela.</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-label-xs text-text-sub-600">Nome da sequência</span>
              <input
                autoFocus
                required
                maxLength={160}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={cn(fieldClass, "h-10")}
                placeholder="Ex.: Demonstração solicitada"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-label-xs text-text-sub-600">
                Descrição <span className="font-normal text-text-sub-600">(opcional)</span>
              </span>
              <textarea
                maxLength={4000}
                rows={2}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className={cn(fieldClass, "resize-y")}
                placeholder="Quando esta sequência deve ser usada?"
              />
            </label>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root type="button" variant="neutral" mode="stroke" size="small" disabled={busy}>Cancelar</Button.Root>
            </Modal.Close>
            <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={busy || !name.trim()}>
              {busy ? "Criando…" : "Criar e adicionar etapas"}
            </Button.Root>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal.Root>
  );
}
