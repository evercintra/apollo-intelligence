"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RiArrowRightSLine, RiCornerDownLeftLine, RiSearchLine } from "@remixicon/react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/utils/cn";
import { paletteItems, type PaletteItem } from "./navConfig";

const LEGACY_ALIASES: Record<string, string> = {
  "análises": "analytics",
  "ação necessária": "action required",
  "prospecção": "outreach prospecting",
  "email": "email",
  "caixa de entrada": "inbox",
  "campanhas de mensagens": "message campaigns",
  "campanhas de ligação": "call campaigns",
  "campanhas de qualificação": "qualification campaigns",
  "campanhas": "campaigns",
  "mensagens": "messages",
  "busca": "search",
  "leads": "leads",
  "pipeline": "pipeline",
  "sequências": "sequences",
  "tabelas": "tables",
  "todos os domínios": "all domains",
  "domínios": "domains",
  "configurações": "settings",
  "organização": "organization",
  "geral": "general",
  "membros": "members",
  "equipes": "teams",
  "chaves de api": "api keys",
  "assistentes de ia": "ai assistants",
  "canais": "channels",
  "caixas de e-mail": "mailboxes",
  "conexão": "connection",
  "regras de envio": "sending rules",
  "contas": "accounts",
  "números de ligação": "calling numbers",
  "números": "numbers",
  "integrações": "integrations",
  "instruções": "instructions",
  "conhecimento": "knowledge",
  "provedor de ia": "ai provider",
  "ia": "ai",
  "crm e leads": "crm leads",
  "categorias de leads": "lead categories",
  "colunas de leads": "lead columns",
  "preferências": "preferences",
  "aparência": "appearance",
  "desenvolvedores": "developers",
  "conexões": "connections",
  "histórico de tarefas": "job history",
  "webhooks do linkedin": "linkedin webhooks",
  "criar": "create",
  "nova campanha de e-mail": "new email campaign",
  "nova campanha no linkedin": "new linkedin campaign",
  "ajuda": "help",
  "documentação": "documentation",
  "reportar um problema": "report a bug",
  "sugerir uma funcionalidade": "request a feature",
  "perguntar à comunidade": "ask the community",
  "reportar uma falha de segurança": "report a security issue",
};

/**
 * "Search or jump to…": every page, settings screen and create shortcut,
 * filtered as you type. ⌘K / Ctrl+K opens it from anywhere; arrows move,
 * Enter goes, Esc closes.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const items = useMemo(() => paletteItems(), []);

  const matches = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return items;
    return items.filter((item) => {
      const hay = `${item.label} ${item.group} ${item.keywords ?? ""}`.toLowerCase();
      const aliases = Object.entries(LEGACY_ALIASES)
        .filter(([term]) => hay.includes(term))
        .map(([, alias]) => alias)
        .join(" ");
      const searchable = `${hay} ${aliases}`.toLowerCase();
      return terms.every((t) => searchable.includes(t));
    });
  }, [items, query]);

  const groups = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const m of matches) map.set(m.group, [...(map.get(m.group) ?? []), m]);
    return [...map];
  }, [matches]);

  function change(next: boolean) {
    if (!next) {
      setQuery("");
      setIndex(0);
    }
    onOpenChange(next);
  }

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    change(false);
    if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
    else router.push(item.href);
  }

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  }, [index]);

  let running = -1;
  return (
    <Dialog.Root open={open} onOpenChange={change}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[12vh] z-50 flex max-h-[70vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-chrome-surface text-chrome-text shadow-regular-md ring-1 ring-inset ring-chrome-border focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setIndex((i) => Math.min(i + 1, matches.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIndex((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter") { e.preventDefault(); go(matches[index]); }
          }}
        >
          <Dialog.Title className="sr-only">Buscar ou ir para</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-chrome-border px-4">
            <RiSearchLine className="size-5 shrink-0 text-chrome-icon" aria-hidden="true" />
            <input
              autoFocus
              value={query}
              onChange={(e) => { setQuery(e.target.value); setIndex(0); }}
              placeholder="Buscar páginas, configurações, ações…"
              aria-label="Buscar páginas, configurações e ações"
              aria-controls="command-palette-list"
              aria-activedescendant={matches[index] ? `cp-${index}` : undefined}
              className="h-12 min-w-0 flex-1 bg-transparent text-paragraph-md text-chrome-text outline-none placeholder:text-chrome-text-muted"
            />
            <kbd className="rounded-md bg-chrome-raised px-1.5 py-0.5 text-label-xs text-chrome-text-muted ring-1 ring-inset ring-chrome-border">Esc</kbd>
          </div>
          <ul ref={listRef} id="command-palette-list" role="listbox" className="flex-1 overflow-y-auto p-2">
            {matches.length === 0 && <li className="px-3 py-10 text-center text-paragraph-sm text-chrome-text-muted">Nada corresponde a “{query}”.</li>}
            {groups.map(([group, groupItems]) => (
              <li key={group} role="presentation">
                <p className="px-3 pb-1 pt-2 text-paragraph-xs text-chrome-text-muted">{group}</p>
                <ul role="presentation">
                  {groupItems.map((item) => {
                    running += 1;
                    const i = running;
                    const Icon = item.icon;
                    const active = i === index;
                    return (
                      <li
                        key={`${item.href}-${item.label}`}
                        id={`cp-${i}`}
                        role="option"
                        aria-selected={active}
                        data-index={i}
                        onMouseMove={() => setIndex(i)}
                        onClick={() => go(item)}
                        className={cn("flex h-10 cursor-pointer items-center gap-3 rounded-lg px-3 text-label-sm", active ? "bg-chrome-active-bg text-chrome-active" : "text-chrome-text-muted")}
                      >
                        <Icon className="size-[18px] shrink-0 text-chrome-icon" aria-hidden="true" />
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {active ? <RiCornerDownLeftLine className="size-4 text-chrome-active" aria-hidden="true" /> : <RiArrowRightSLine className="size-4 text-chrome-border" aria-hidden="true" />}
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
