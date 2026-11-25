"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RiChat1Line,
  RiDashboard3Line,
  RiDownloadLine,
  RiErrorWarningLine,
  RiFireLine,
  RiLoader4Line,
  RiMoreLine,
  RiPhoneLine,
  RiRefreshLine,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";
import { WhatsappLogo } from "./WhatsappLogo";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Dropdown from "@/components/alignui/dropdown";
import * as Table from "@/components/alignui/table";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { KpiCell, KpiStrip } from "@/components/analytics/kit/KpiStrip";
import { EmptyState } from "@/components/page/EmptyState";
import { errorMessage, formatDate } from "@/components/crm/crm-utils";
import {
  AccountIdentity,
  AccountsFrame,
  AccountsNoMatch,
  PresenceDot,
  type AccountFilter,
} from "@/components/settings/AccountsOverview";
import { Callout } from "@/components/settings/SettingsKit";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { AccountsSkeleton } from "@/components/settings/SettingsSkeletons";
import {
  backfillWhatsappAccount,
  listWhatsappAccounts,
  setDefaultWhatsappAccount,
  setWhatsappNewChatsPerDay,
  syncWhatsappAccounts,
} from "@/lib/whatsapp/client";
import { type WhatsappAccountStatus, type WhatsappAccountSummary } from "@/lib/whatsapp/contract";
import { AccountLimitDialog } from "@/components/settings/AccountLimitDialog";
import { numberRule } from "@/lib/channels/rules";
import { cn } from "@/utils/cn";

const STATUS_LABEL: Record<WhatsappAccountStatus, string> = {
  connected: "Conectado",
  credentials: "Precisa de credenciais",
  disconnected: "Desconectado",
  error: "Erro",
};
const STATUS_COLOR: Record<WhatsappAccountStatus, React.ComponentProps<typeof Badge.Root>["color"]> = {
  connected: "green",
  credentials: "orange",
  disconnected: "red",
  error: "red",
};

function isFuture(iso: string | null): boolean {
  return Boolean(iso) && new Date(iso as string).getTime() > Date.now();
}

const healthy = (a: WhatsappAccountSummary) => a.status === "connected";

/** The organization's rules (Settings → WhatsApp → Sending rules) the numbers follow. */
export type WhatsappNumberRules = { warmupHours: number; newChatsPerDay: number; secondsBetweenSends: number };

export function WhatsappAccountsClient({ rules }: { rules: WhatsappNumberRules }) {
  const [accounts, setAccounts] = useState<WhatsappAccountSummary[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("all");
  const [limitAccount, setLimitAccount] = useState<WhatsappAccountSummary | null>(null);
  const newChatsOf = (a: WhatsappAccountSummary) => a.newChatsPerDay ?? rules.newChatsPerDay;

  const load = useCallback(async () => {
    try {
      setAccounts((await listWhatsappAccounts()).accounts);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    setNotice("");
    setError("");
    try {
      const response = await syncWhatsappAccounts();
      setAccounts(response.accounts);
      setNotice(response.accounts.length ? "Sincronizado com a Unipile." : "Sincronizado — a Unipile ainda não tem nenhum número do WhatsApp vinculado.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSyncing(false);
    }
  };

  const makeDefault = async (account: WhatsappAccountSummary) => {
    setBusyId(account.id);
    setNotice("");
    try {
      await setDefaultWhatsappAccount(account.id);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const backfill = async (account: WhatsappAccountSummary) => {
    setBusyId(account.id);
    setNotice("");
    setError("");
    try {
      await backfillWhatsappAccount(account.id);
      setNotice(`Importando conversas recentes de ${account.name || account.phone || "este número"}. Elas aparecem em Mensagens em instantes.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (accounts ?? []).filter((a) => {
      if (filter === "healthy" && !healthy(a)) return false;
      if (filter === "attention" && healthy(a)) return false;
      return !q || `${a.name ?? ""} ${a.phone ?? ""}`.toLowerCase().includes(q);
    });
  }, [accounts, query, filter]);

  const total = accounts?.length ?? 0;
  const connected = accounts?.filter(healthy).length ?? 0;
  const attention = total - connected;
  const warmingCount = accounts?.filter((a) => isFuture(a.warmUpEndsAt)).length ?? 0;
  const defaultAccount = accounts?.find((a) => a.isDefault) ?? null;

  const syncAction = (
    <Button.Root variant="primary" mode="filled" size="small" disabled={syncing} onClick={() => void sync()}>
      <Button.Icon as={RiRefreshLine} className={cn(syncing && "animate-spin")} />
      {syncing ? "Sincronizando…" : "Sincronizar com a Unipile"}
    </Button.Root>
  );

  return (
    <SettingsPage
      title="Contas do WhatsApp"
      description="Os números usados pelo Apollo Intelligence para enviar mensagens, vinculados na Unipile. As ligações são feitas em web.whatsapp.com pela extensão gravadora."
      actions={syncAction}
    >
      <div className="space-y-5">
        {notice && <Callout tone="success">{notice}</Callout>}
        {error && (
          <Callout
            tone="error"
            action={
              !accounts && (
                <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={() => void load()}>
                  Tentar novamente
                </Button.Root>
              )
            }
          >
            {error}
          </Callout>
        )}

        {accounts === null ? (
          !error && <AccountsSkeleton />
        ) : accounts.length === 0 ? (
          <Frame>
            <FramePanel>
              <EmptyState
                icon={WhatsappLogo}
                title="Nenhum número do WhatsApp ainda"
                description="No painel da Unipile, escolha Accounts → Connect → WhatsApp e leia o QR com o celular usado pelo vendedor. Depois sincronize aqui."
                action={syncAction}
              />
            </FramePanel>
          </Frame>
        ) : (
          <div>
            <KpiStrip columns={4}>
              <KpiCell icon={RiPhoneLine} label="Conectados" value={String(connected)} context={`de ${total} ${total === 1 ? "número" : "números"}`} />
              <KpiCell
                icon={RiErrorWarningLine}
                label="Precisam de atenção"
                value={String(attention)}
                context={attention === 0 ? "Todos os números podem enviar" : "Vincule novamente na Unipile e sincronize"}
                hint="Números desconectados, sem credenciais ou com erro. Um número bloqueado também perde a ligação."
              />
              <KpiCell
                icon={RiFireLine}
                label="Aquecendo"
                value={String(warmingCount)}
                context={`Sem novas conversas por ${rules.warmupHours} h após a vinculação`}
                hint="Um número recém-vinculado pode responder conversas existentes na hora, mas só inicia novas após o aquecimento, para evitar bloqueios."
              />
              <KpiCell
                icon={RiChat1Line}
                label="Novas conversas por dia"
                value={String((accounts ?? []).filter(healthy).reduce((sum, a) => sum + newChatsOf(a), 0))}
                context={`${rules.newChatsPerDay} por número · ${rules.secondsBetweenSends} s entre envios`}
                hint="Cada número conectado inicia no máximo esse número de conversas novas por dia, com intervalo entre envios. Altere em WhatsApp → Regras de envio ou por número."
              />
            </KpiStrip>

            <AccountsFrame
              title="Números"
              description={defaultAccount ? `${defaultAccount.name || defaultAccount.phone || "O número padrão"} é usado quando nenhum outro é escolhido.` : "Ainda não há número padrão — defina um pelo menu do número."}
              filter={filter}
              onFilterChange={setFilter}
              counts={{ all: total, healthy: connected, attention }}
              search={query}
              onSearchChange={setQuery}
              searchPlaceholder="Buscar números…"
            >
              {filtered.length === 0 ? (
                <AccountsNoMatch noun="numbers" />
              ) : (
                <Table.Root className="min-w-180 [&>table]:table-fixed">
                  <Table.Header>
                    <Table.Row>
                      <Table.Head scope="col" className="px-4">Número</Table.Head>
                      <Table.Head scope="col" className="w-64 px-4">Status</Table.Head>
                      <Table.Head scope="col" className="w-36 px-4">Novas conversas por dia</Table.Head>
                      <Table.Head scope="col" className="w-36 px-4">Última sincronização</Table.Head>
                      <Table.Head scope="col" className="w-16 px-4"><span className="sr-only">Ações</span></Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body spacing={4}>
                    {filtered.map((account) => {
                      const warming = isFuture(account.warmUpEndsAt);
                      const busy = busyId === account.id;
                      const label = account.name || account.phone || "este número";
                      return (
                        <Table.Row key={account.id} className={cn(busy && "opacity-60")} aria-busy={busy || undefined}>
                          <Table.Cell className="h-16 px-4">
                            <AccountIdentity
                              media={
                                <>
                                  <WhatsappLogo className="size-8" />
                                  <PresenceDot ok={healthy(account)} />
                                </>
                              }
                              name={
                                <>
                                  <span className="truncate text-label-sm text-text-strong-950">{account.name || account.phone || "Número do WhatsApp"}</span>
                                  {account.isDefault && (
                                    <Badge.Root size="small" variant="lighter" color="purple" className="shrink-0">
                                      <Badge.Icon as={RiStarFill} />
                                      Padrão
                                    </Badge.Root>
                                  )}
                                </>
                              }
                              detail={account.phone && account.name ? account.phone : undefined}
                            />
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge.Root size="medium" variant="lighter" color={STATUS_COLOR[account.status]}>
                                <Badge.Dot />
                                {STATUS_LABEL[account.status]}
                              </Badge.Root>
                              {warming && (
                                <span className="text-paragraph-xs text-text-sub-600" suppressHydrationWarning>
                                  Aquecendo até {formatDate(account.warmUpEndsAt)}
                                </span>
                              )}
                            </div>
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <p className="text-paragraph-sm tabular-nums text-text-strong-950">{newChatsOf(account)}</p>
                            {account.newChatsPerDay !== null && <p className="text-paragraph-xs text-text-sub-600">Limite próprio</p>}
                          </Table.Cell>
                          <Table.Cell className="whitespace-nowrap px-4 text-paragraph-sm text-text-sub-600" suppressHydrationWarning>
                            {account.lastSyncedAt ? formatDate(account.lastSyncedAt) : "Nunca"}
                          </Table.Cell>
                          <Table.Cell className="px-4">
                            <div className="flex justify-end">
                              <Dropdown.Root>
                                <Dropdown.Trigger asChild>
                                  <Button.Root variant="neutral" mode="ghost" size="xsmall" disabled={busy} aria-label={`Mais ações para ${label}`}>
                                    <Button.Icon as={busy ? RiLoader4Line : RiMoreLine} className={cn(busy && "animate-spin")} />
                                  </Button.Root>
                                </Dropdown.Trigger>
                                <Dropdown.Content align="end">
                                  {!account.isDefault && (
                                    <Dropdown.Item onSelect={() => void makeDefault(account)}>
                                      <Dropdown.ItemIcon as={RiStarLine} />
                                      Definir como padrão
                                    </Dropdown.Item>
                                  )}
                                  <Dropdown.Item disabled={account.status !== "connected"} onSelect={() => void backfill(account)}>
                                    <Dropdown.ItemIcon as={RiDownloadLine} />
                                    Importar conversas recentes
                                  </Dropdown.Item>
                                  <Dropdown.Item onSelect={() => setLimitAccount(account)}>
                                    <Dropdown.ItemIcon as={RiDashboard3Line} />
                                    Novas conversas por dia
                                  </Dropdown.Item>
                                </Dropdown.Content>
                              </Dropdown.Root>
                            </div>
                          </Table.Cell>
                        </Table.Row>
                      );
                    })}
                  </Table.Body>
                </Table.Root>
              )}
            </AccountsFrame>
          </div>
        )}
      </div>
      {limitAccount && (
        <AccountLimitDialog
          key={limitAccount.id}
          title="Novas conversas por dia"
          accountLabel={limitAccount.name || limitAccount.phone || "este número"}
          rule={numberRule("whatsapp", "newChatsPerDay")}
          organizationValue={rules.newChatsPerDay}
          value={limitAccount.newChatsPerDay}
          onClose={() => setLimitAccount(null)}
          onSave={async (newChatsPerDay) => {
            const updated = await setWhatsappNewChatsPerDay(limitAccount.id, newChatsPerDay);
            setAccounts((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? prev);
          }}
        />
      )}
    </SettingsPage>
  );
}
