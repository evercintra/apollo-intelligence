"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { RiAddLine, RiCloudLine, RiGlobalLine, RiLinkM, RiLoader4Line, RiPauseCircleLine, RiPencilLine, RiPlayCircleLine, RiDeleteBinLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import * as Modal from "@/components/alignui/modal";
import * as Select from "@/components/alignui/select";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { FormError, TextField } from "@/components/calls/fields";
import { errorMessage, timeAgo } from "@/components/crm/crm-utils";
import { EmptyState } from "@/components/page/EmptyState";
import { Callout } from "@/components/settings/SettingsKit";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { DocsLink } from "@/components/page/DocsLink";
import {
  cancelStationLink,
  createCallingProxy,
  createCallingStation,
  deleteCallingProxy,
  deleteCallingStation,
  listCallingProxies,
  listCallingStations,
  startStationLink,
  updateCallingProxy,
  updateCallingStation,
} from "@/lib/calls/client";
import {
  PROXY_PROTOCOLS,
  STATION_LAUNCHERS,
  usesGoLogin,
  type CallingProxy,
  type CallingStation,
  type ProxyProtocol,
  type StationLauncher,
  type StationStatus,
} from "@/lib/calls/stationContract";
import { hoursInvalid, hoursSummary, StationHoursEditor } from "@/components/calling/ai/StationHoursEditor";
import type { StationAiSettings, StationAiSettingsResponse } from "@/lib/calls/aiCampaigns/api";
import { listStationAiSettings, updateStationAiSettings } from "@/lib/calls/aiCampaigns/client";
import type { WeeklyHours } from "@/lib/channels/rules";
import { cn } from "@/utils/cn";

const LAUNCHER_LABEL: Record<StationLauncher, string> = {
  cloak: "CloakBrowser",
  local: "Chromium local",
  gologin_sdk: "GoLogin (este servidor)",
  gologin_cloud: "GoLogin Cloud",
};

const STATUS_LABEL: Record<StationStatus, string> = {
  onboarding: "Ainda não vinculado",
  active: "Ativo",
  paused: "Pausado",
  logged_out: "Sessão encerrada",
  banned: "Bloqueado",
};
const STATUS_COLOR: Record<StationStatus, React.ComponentProps<typeof Badge.Root>["color"]> = {
  onboarding: "gray",
  active: "green",
  paused: "orange",
  logged_out: "red",
  banned: "red",
};


/** Fast while something is happening (a link code to show, a call to follow), slow otherwise. */
const POLL_BUSY_MS = 3000;
const POLL_IDLE_MS = 15000;

/** Radix selects cannot hold an empty value, so "no IP" is this. */
const NO_PROXY = "none";

type Draft = {
  name: string;
  phone: string;
  launcher: StationLauncher;
  gologinProfileId: string;
  proxyId: string;
  /** AI campaign calls a day from this number; blank = the organization's rule. */
  callsPerDay: string;
  /** Its own calling hours; null = the organization's rule. */
  callingHours: WeeklyHours | null;
};
const EMPTY_DRAFT: Draft = { name: "", phone: "", launcher: "cloak", gologinProfileId: "", proxyId: NO_PROXY, callsPerDay: "", callingHours: null };
const FALLBACK_HOURS: WeeklyHours = { timezone: "Asia/Kolkata", days: [1, 2, 3, 4, 5, 6], start: "12:00", end: "19:00" };

type ProxyDraft = {
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
  username: string;
  password: string;
  country: string;
  timezone: string;
  provider: string;
  notes: string;
};
const EMPTY_PROXY_DRAFT: ProxyDraft = {
  label: "",
  protocol: "http",
  host: "",
  port: "",
  username: "",
  password: "",
  country: "IN",
  timezone: "Asia/Kolkata",
  provider: "",
  notes: "",
};

export function CallingStationsSettings() {
  const [stations, setStations] = useState<CallingStation[] | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  /** "new", or the id of the station being edited. */
  const [formFor, setFormFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<CallingStation | null>(null);
  /** Numbers whose wrong-account question the operator put off ("Decide later"), until the page reloads. */
  const [putOff, setPutOff] = useState<ReadonlySet<string>>(new Set());
  const [proxies, setProxies] = useState<CallingProxy[]>([]);
  /** Each number's own AI calls a day and calling hours, and the organization rules they fall back to. */
  const [aiSettings, setAiSettings] = useState<StationAiSettingsResponse | null>(null);
  /** "new", or the id of the IP being edited. */
  const [proxyFormFor, setProxyFormFor] = useState<string | null>(null);
  const [proxyDraft, setProxyDraft] = useState<ProxyDraft>(EMPTY_PROXY_DRAFT);
  const [proxyFormError, setProxyFormError] = useState("");
  const [deletingProxy, setDeletingProxy] = useState<CallingProxy | null>(null);

  const load = useCallback(async () => {
    try {
      const [stationList, proxyList, ai] = await Promise.all([
        listCallingStations(),
        listCallingProxies(),
        // Shown beside each number; the page works without it.
        listStationAiSettings().catch(() => null),
      ]);
      setStations(stationList.stations);
      setProxies(proxyList.proxies);
      if (ai) setAiSettings(ai);
      setError("");
    } catch (cause) {
      setError(errorMessage(cause));
    }
  }, []);

  const hot = stations?.some((station) => station.link !== null || station.busyCallId !== null) ?? false;
  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), hot ? POLL_BUSY_MS : POLL_IDLE_MS);
    return () => clearInterval(interval);
  }, [load, hot]);

  /** Runs one action on a station and swaps the station it returns into the list. */
  const act = async (station: CallingStation, run: () => Promise<{ station: CallingStation }>) => {
    setBusyId(station.id);
    setError("");
    try {
      const { station: next } = await run();
      setStations((current) => (current ?? []).map((item) => (item.id === next.id ? next : item)));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusyId(null);
    }
  };

  // A link that ended on another WhatsApp account than the number: ask which is right.
  const wrongAccount =
    stations?.find((station) => station.linkedPhone !== null && station.linkedPhone !== station.phone && station.link === null && !putOff.has(station.id)) ?? null;

  const openAdd = () => {
    setDraft(EMPTY_DRAFT);
    setFormError("");
    setFormFor("new");
  };
  const aiOf = (stationId: string): StationAiSettings | null => aiSettings?.settings.find((item) => item.stationId === stationId) ?? null;
  const openEdit = (station: CallingStation) => {
    const own = aiOf(station.id);
    setDraft({
      name: station.name,
      phone: station.phone,
      launcher: station.launcher,
      gologinProfileId: station.gologinProfileId ?? "",
      proxyId: station.proxyId ?? NO_PROXY,
      callsPerDay: own?.callsPerDay != null ? String(own.callsPerDay) : "",
      callingHours: own?.callingHours ?? null,
    });
    setFormError("");
    setFormFor(station.id);
  };

  const save = async () => {
    setSaving(true);
    setFormError("");
    const gologinProfileId = usesGoLogin(draft.launcher) ? draft.gologinProfileId.trim() || null : null;
    const proxyId = draft.proxyId === NO_PROXY ? null : draft.proxyId;
    const callsPerDay = draft.callsPerDay.trim() === "" ? null : Number(draft.callsPerDay);
    if (callsPerDay !== null && (!Number.isInteger(callsPerDay) || callsPerDay < 1 || callsPerDay > 100)) {
      setSaving(false);
      return setFormError("As ligações de IA por dia devem ser um número inteiro de 1 a 100; deixe em branco para usar a regra da organização.");
    }
    if (draft.callingHours && hoursInvalid(draft.callingHours)) {
      setSaving(false);
      return setFormError("O horário de ligações precisa de pelo menos um dia e um fim posterior ao início.");
    }
    try {
      let savedId = formFor;
      if (formFor === "new") {
        const { station } = await createCallingStation({
          name: draft.name.trim(),
          phone: draft.phone.trim(),
          launcher: draft.launcher,
          gologinProfileId,
          proxyId,
        });
        savedId = station.id;
        setStations((current) => [...(current ?? []), station]);
      } else if (formFor) {
        const { station } = await updateCallingStation(formFor, { name: draft.name.trim(), launcher: draft.launcher, gologinProfileId, proxyId });
        setStations((current) => (current ?? []).map((item) => (item.id === station.id ? station : item)));
      }
      // Only touched when it differs, so saving the other fields never rewrites a number's AI limits.
      const before = savedId && savedId !== "new" ? aiOf(savedId) : null;
      if (savedId && savedId !== "new" && (callsPerDay !== (before?.callsPerDay ?? null) || JSON.stringify(draft.callingHours) !== JSON.stringify(before?.callingHours ?? null))) {
        await updateStationAiSettings(savedId, { callsPerDay, callingHours: draft.callingHours });
      }
      setFormFor(null);
      void load();
    } catch (cause) {
      setFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const openAddProxy = () => {
    setProxyDraft(EMPTY_PROXY_DRAFT);
    setProxyFormError("");
    setProxyFormFor("new");
  };
  const openEditProxy = (proxy: CallingProxy) => {
    setProxyDraft({
      label: proxy.label,
      protocol: proxy.protocol,
      host: proxy.host,
      port: String(proxy.port),
      username: proxy.username ?? "",
      password: "",
      country: proxy.country ?? "",
      timezone: proxy.timezone ?? "",
      provider: proxy.provider ?? "",
      notes: proxy.notes ?? "",
    });
    setProxyFormError("");
    setProxyFormFor(proxy.id);
  };

  const saveProxy = async () => {
    const port = Number(proxyDraft.port);
    if (!proxyDraft.host.trim()) return setProxyFormError("O host é obrigatório.");
    if (!Number.isInteger(port) || port < 1 || port > 65535) return setProxyFormError("A porta deve ser um número de 1 a 65535.");
    setSaving(true);
    setProxyFormError("");
    const request = {
      label: proxyDraft.label.trim(),
      protocol: proxyDraft.protocol,
      host: proxyDraft.host.trim(),
      port,
      username: proxyDraft.username.trim() || null,
      country: proxyDraft.country.trim().toUpperCase() || null,
      timezone: proxyDraft.timezone.trim() || null,
      provider: proxyDraft.provider.trim() || null,
      notes: proxyDraft.notes.trim() || null,
      // Left out when blank, so an edit keeps the saved password.
      ...(proxyDraft.password ? { password: proxyDraft.password } : {}),
    };
    try {
      if (proxyFormFor === "new") await createCallingProxy(request);
      else if (proxyFormFor) await updateCallingProxy(proxyFormFor, request);
      setProxyFormFor(null);
      await load();
    } catch (cause) {
      setProxyFormError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteProxy = async () => {
    if (!deletingProxy) return;
    setSaving(true);
    try {
      await deleteCallingProxy(deletingProxy.id);
      setDeletingProxy(null);
      await load();
    } catch (cause) {
      setError(errorMessage(cause));
      setDeletingProxy(null);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await deleteCallingStation(deleting.id);
      setStations((current) => (current ?? []).filter((item) => item.id !== deleting.id));
      setDeleting(null);
      void load();
    } catch (cause) {
      setError(errorMessage(cause));
      setDeleting(null);
    } finally {
      setSaving(false);
    }
  };

  const addButton = (
    <Button.Root variant="primary" mode="filled" size="small" onClick={openAdd}>
      <Button.Icon as={RiAddLine} />
      Adicionar número
    </Button.Root>
  );

  const editingProxy = proxyFormFor && proxyFormFor !== "new" ? proxies.find((proxy) => proxy.id === proxyFormFor) : null;
  const canSaveProxy = proxyDraft.label.trim() && proxyDraft.host.trim() && proxyDraft.port.trim();
  /** An IP is offered to a number while it is free or already that number's. */
  const proxyChoices = proxies.filter((proxy) => proxy.stationId === null || proxy.stationId === formFor);
  const editing = formFor && formFor !== "new" ? stations?.find((station) => station.id === formFor) : null;
  const canSave = draft.name.trim() && (formFor !== "new" || draft.phone.trim()) && (!usesGoLogin(draft.launcher) || draft.gologinProfileId.trim());

  return (
    <SettingsPage
      title="Números de ligação"
      description="Números de WhatsApp usados pelo agente de IA para ligar, com o WhatsApp Web rodando em um navegador remoto em vez do computador de um representante."
      actions={addButton}
    >
      <div className="space-y-5">
        <Callout tone="info" title="Como funciona a ligação em nuvem">
          Um número de ligação é um número de WhatsApp vinculado a um perfil de navegador que um worker abre a cada chamada. É preciso ter um worker ativo
          {" "}e, para perfis GoLogin, a integração GoLogin conectada em{" "}
          <Link href="/settings/whatsapp-connection" className="underline">Configurações → WhatsApp → Integrações</Link>.{" "}
          <DocsLink page="whatsapp/calling#what-you-need">O que é necessário</DocsLink>
        </Callout>
        {error && <Callout tone="error">{error}</Callout>}

        {stations === null ? (
          !error && (
            <div className="flex justify-center py-12" aria-busy="true" aria-label="Carregando números de ligação">
              <RiLoader4Line className="size-5 animate-spin text-text-sub-600" aria-hidden="true" />
            </div>
          )
        ) : stations.length === 0 ? (
          <Frame>
            <FramePanel>
              <EmptyState
                icon={RiCloudLine}
                title="Ainda não há números de ligação"
                description="Adicione um número de WhatsApp e seu perfil de navegador, depois vincule-o ao WhatsApp Web por aqui."
                action={addButton}
              />
            </FramePanel>
          </Frame>
        ) : (
          <div className="space-y-3">
            {stations.map((station) => (
              <StationCard
                key={station.id}
                station={station}
                ai={aiOf(station.id)}
                rules={aiSettings?.rules ?? null}
                busy={busyId === station.id}
                // Relinking a number logged in as the wrong account starts it logged out.
                onLink={() => void act(station, () => startStationLink(station.id, { fresh: station.linkedPhone !== null && station.linkedPhone !== station.phone }))}
                onCancelLink={() => void act(station, () => cancelStationLink(station.id))}
                onToggle={() => void act(station, () => updateCallingStation(station.id, { status: station.status === "paused" ? "active" : "paused" }))}
                onEdit={() => openEdit(station)}
                onDelete={() => setDeleting(station)}
                onUseLinkedPhone={() => void act(station, () => updateCallingStation(station.id, { phone: station.linkedPhone! }))}
              />
            ))}
          </div>
        )}

        {stations !== null && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <h2 className="text-label-md text-text-strong-950">IPs</h2>
                <p className="text-paragraph-sm text-text-sub-600">Cada número sai por seu próprio IP. Proxies estáticos de ISP indiano; um número por IP.</p>
              </div>
              <Button.Root variant="neutral" mode="stroke" size="small" onClick={openAddProxy}>
                <Button.Icon as={RiAddLine} />
                Adicionar IP
              </Button.Root>
            </div>
            {proxies.length === 0 ? (
              <p className="text-paragraph-sm text-text-sub-600">Ainda não há IPs. Números sem IP usam o IP do worker.</p>
            ) : (
              <div className="space-y-3">
                {proxies.map((proxy) => (
                  <ProxyCard key={proxy.id} proxy={proxy} onEdit={() => openEditProxy(proxy)} onDelete={() => setDeletingProxy(proxy)} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Modal.Root open={formFor !== null} onOpenChange={(open) => { if (!open && !saving) setFormFor(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiCloudLine}>
            <Modal.Title>{formFor === "new" ? "Adicionar número de ligação" : "Editar número de ligação"}</Modal.Title>
            <Modal.Description>
              {formFor === "new"
                ? "Depois de adicionar, use Vincular WhatsApp para entrar com o número no WhatsApp Web."
                : `${editing?.phone ?? "O número"} não pode ser alterado aqui; exclua e adicione novamente para usar outro número.`}
            </Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            {formError && <FormError>{formError}</FormError>}
            <TextField label="Nome" autoFocus value={draft.name} onChange={(name) => setDraft((d) => ({ ...d, name }))} placeholder="Linha de vendas 1" disabled={saving} />
            {formFor === "new" && (
              <TextField label="Número de WhatsApp" value={draft.phone} onChange={(phone) => setDraft((d) => ({ ...d, phone }))} placeholder="+91 98765 43210" disabled={saving} />
            )}
            <div>
              <label className="mb-1.5 block text-label-sm text-text-strong-950">Navegador</label>
              <Select.Root size="small" value={draft.launcher} onValueChange={(launcher) => setDraft((d) => ({ ...d, launcher: launcher as StationLauncher }))} disabled={saving}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {STATION_LAUNCHERS.map((launcher) => (
                    <Select.Item key={launcher} value={launcher}>{LAUNCHER_LABEL[launcher]}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            <div>
              <label className="mb-1.5 block text-label-sm text-text-strong-950">IP</label>
              <Select.Root size="small" value={draft.proxyId} onValueChange={(proxyId) => setDraft((d) => ({ ...d, proxyId }))} disabled={saving}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value={NO_PROXY}>Nenhum (IP do próprio worker)</Select.Item>
                  {proxyChoices.map((proxy) => (
                    <Select.Item key={proxy.id} value={proxy.id}>{proxy.label} · {proxy.host}</Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </div>
            {usesGoLogin(draft.launcher) && (
              <TextField
                label="ID do perfil no GoLogin"
                value={draft.gologinProfileId}
                onChange={(gologinProfileId) => setDraft((d) => ({ ...d, gologinProfileId }))}
                placeholder="O ID do perfil no GoLogin"
                disabled={saving}
              />
            )}
            <div className="border-t border-stroke-soft-200 pt-3">
              <p className="mb-2 text-label-sm text-text-strong-950">Campanhas de IA</p>
              <TextField
                label="Ligações de IA por dia"
                inputMode="numeric"
                value={draft.callsPerDay}
                onChange={(callsPerDay) => setDraft((d) => ({ ...d, callsPerDay }))}
                placeholder={aiSettings ? `Em branco: regra da organização (${aiSettings.rules.callsPerDay})` : "Em branco: regra da organização"}
                disabled={saving}
              />
              <div className="mt-3">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <label className="text-label-sm text-text-strong-950">Horário de ligações</label>
                  {draft.callingHours ? (
                    <button type="button" disabled={saving} onClick={() => setDraft((d) => ({ ...d, callingHours: null }))} className="text-paragraph-xs text-text-sub-600 underline-offset-2 hover:underline disabled:opacity-50">
                      Usar o horário da organização
                    </button>
                  ) : (
                    <button type="button" disabled={saving} onClick={() => setDraft((d) => ({ ...d, callingHours: aiSettings?.rules.callingHours ?? FALLBACK_HOURS }))} className="text-paragraph-xs text-text-sub-600 underline-offset-2 hover:underline disabled:opacity-50">
                      Definir horário para este número
                    </button>
                  )}
                </div>
                {draft.callingHours ? (
                  <StationHoursEditor value={draft.callingHours} onChange={(callingHours) => setDraft((d) => ({ ...d, callingHours }))} disabled={saving} />
                ) : (
                  <p className="text-paragraph-xs text-text-sub-600">{aiSettings ? `Horário da organização: ${hoursSummary(aiSettings.rules.callingHours)}` : "Horário de ligações da organização (Configurações → WhatsApp → Regras de envio)."}</p>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancelar</Button.Root>
            </Modal.Close>
            <Button.Root variant="primary" mode="filled" size="small" disabled={saving || !canSave} onClick={() => void save()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              {formFor === "new" ? "Adicionar número" : "Salvar"}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={proxyFormFor !== null} onOpenChange={(open) => { if (!open && !saving) setProxyFormFor(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiGlobalLine}>
            <Modal.Title>{proxyFormFor === "new" ? "Adicionar IP" : "Editar IP"}</Modal.Title>
            <Modal.Description>Um proxy pelo qual o navegador de um número de ligação acessa a internet. Pode ser atribuído a um número.</Modal.Description>
          </Modal.Header>
          <Modal.Body className="space-y-3">
            {proxyFormError && <FormError>{proxyFormError}</FormError>}
            <TextField label="Rótulo" autoFocus value={proxyDraft.label} onChange={(label) => setProxyDraft((d) => ({ ...d, label }))} placeholder="ISP Mumbai 1" disabled={saving} />
            <div className="grid grid-cols-[8rem_1fr_6rem] gap-3">
              <div>
                <label className="mb-1.5 block text-label-sm text-text-strong-950">Protocolo</label>
                <Select.Root size="small" value={proxyDraft.protocol} onValueChange={(protocol) => setProxyDraft((d) => ({ ...d, protocol: protocol as ProxyProtocol }))} disabled={saving}>
                  <Select.Trigger><Select.Value /></Select.Trigger>
                  <Select.Content>
                    {PROXY_PROTOCOLS.map((protocol) => (
                      <Select.Item key={protocol} value={protocol}>{protocol}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </div>
              <TextField label="Host" value={proxyDraft.host} onChange={(host) => setProxyDraft((d) => ({ ...d, host }))} placeholder="203.0.113.10" disabled={saving} />
              <TextField label="Porta" inputMode="numeric" value={proxyDraft.port} onChange={(port) => setProxyDraft((d) => ({ ...d, port }))} placeholder="1080" disabled={saving} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextField label="Usuário" autoComplete="off" value={proxyDraft.username} onChange={(username) => setProxyDraft((d) => ({ ...d, username }))} disabled={saving} />
              <TextField
                label="Senha"
                type="password"
                autoComplete="new-password"
                value={proxyDraft.password}
                onChange={(password) => setProxyDraft((d) => ({ ...d, password }))}
                placeholder={editingProxy?.hasPassword ? "Salva — deixe em branco para manter" : ""}
                disabled={saving}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="País" value={proxyDraft.country} onChange={(country) => setProxyDraft((d) => ({ ...d, country }))} placeholder="IN" disabled={saving} />
              <TextField label="Fuso horário" value={proxyDraft.timezone} onChange={(timezone) => setProxyDraft((d) => ({ ...d, timezone }))} placeholder="Asia/Kolkata" disabled={saving} />
            </div>
            <TextField label="Provedor" value={proxyDraft.provider} onChange={(provider) => setProxyDraft((d) => ({ ...d, provider }))} disabled={saving} />
            <TextField label="Observações" value={proxyDraft.notes} onChange={(notes) => setProxyDraft((d) => ({ ...d, notes }))} disabled={saving} />
          </Modal.Body>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancelar</Button.Root>
            </Modal.Close>
            <Button.Root variant="primary" mode="filled" size="small" disabled={saving || !canSaveProxy} onClick={() => void saveProxy()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              {proxyFormFor === "new" ? "Adicionar IP" : "Salvar"}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={deletingProxy !== null} onOpenChange={(open) => { if (!open && !saving) setDeletingProxy(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiDeleteBinLine}>
            <Modal.Title>Excluir {deletingProxy?.label}?</Modal.Title>
            <Modal.Description>O IP é removido desta lista. O contrato do proxy com o provedor não é cancelado.</Modal.Description>
          </Modal.Header>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancelar</Button.Root>
            </Modal.Close>
            <Button.Root variant="error" mode="filled" size="small" disabled={saving} onClick={() => void confirmDeleteProxy()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              Excluir
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={wrongAccount !== null} onOpenChange={(open) => { if (!open && wrongAccount) setPutOff((current) => new Set(current).add(wrongAccount.id)); }}>
        <Modal.Content>
          <Modal.Header icon={RiLinkM}>
            <Modal.Title>Vinculado a outro número de WhatsApp</Modal.Title>
            <Modal.Description>
              {wrongAccount
                ? `O WhatsApp Web de ${wrongAccount.name} está conectado como ${wrongAccount.linkedPhone}, e não como ${wrongAccount.phone}. As ligações saem do número conectado, então este número não ligará até você escolher.`
                : ""}
            </Modal.Description>
          </Modal.Header>
          {wrongAccount && (
            <Modal.Body className="space-y-2 text-paragraph-sm text-text-sub-600">
              <p>
                <span className="text-label-sm text-text-strong-950">Usar {wrongAccount.linkedPhone}</span> — mantenha este login e faça dele o número desta linha de ligação.
              </p>
              <p>
                <span className="text-label-sm text-text-strong-950">Vincular {wrongAccount.phone}</span> — descarte este login (o número mantém a impressão digital do navegador) e vincule novamente pelo celular com {wrongAccount.phone}. Depois, remova o dispositivo extra em WhatsApp → Dispositivos conectados de {wrongAccount.linkedPhone}.
              </p>
            </Modal.Body>
          )}
          <Modal.Footer>
            <Button.Root
              variant="neutral"
              mode="ghost"
              size="small"
              disabled={wrongAccount !== null && busyId === wrongAccount.id}
              onClick={() => wrongAccount && setPutOff((current) => new Set(current).add(wrongAccount.id))}
            >
              Decidir depois
            </Button.Root>
            <Button.Root
              variant="neutral"
              mode="stroke"
              size="small"
              disabled={wrongAccount !== null && busyId === wrongAccount.id}
              onClick={() => wrongAccount && void act(wrongAccount, () => startStationLink(wrongAccount.id, { fresh: true }))}
            >
              Vincular {wrongAccount?.phone}
            </Button.Root>
            <Button.Root
              variant="primary"
              mode="filled"
              size="small"
              disabled={wrongAccount !== null && busyId === wrongAccount.id}
              onClick={() => wrongAccount && void act(wrongAccount, () => updateCallingStation(wrongAccount.id, { phone: wrongAccount.linkedPhone! }))}
            >
              Usar {wrongAccount?.linkedPhone}
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>

      <Modal.Root open={deleting !== null} onOpenChange={(open) => { if (!open && !saving) setDeleting(null); }}>
        <Modal.Content>
          <Modal.Header icon={RiDeleteBinLine}>
            <Modal.Title>Excluir {deleting?.name}?</Modal.Title>
            <Modal.Description>
              {deleting?.phone} deixará de estar disponível para ligações do agente de IA. As gravações e o histórico de ligações permanecem. O perfil do navegador não é excluído.
            </Modal.Description>
          </Modal.Header>
          <Modal.Footer>
            <Modal.Close asChild>
              <Button.Root variant="neutral" mode="stroke" size="small" disabled={saving}>Cancelar</Button.Root>
            </Modal.Close>
            <Button.Root variant="error" mode="filled" size="small" disabled={saving} onClick={() => void confirmDelete()}>
              {saving && <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />}
              Excluir
            </Button.Root>
          </Modal.Footer>
        </Modal.Content>
      </Modal.Root>
    </SettingsPage>
  );
}

function StationCard({ station, ai, rules, busy, onLink, onCancelLink, onToggle, onEdit, onDelete, onUseLinkedPhone }: {
  station: CallingStation;
  /** This number's own AI campaign limits (null fields: the organization's rule). */
  ai: StationAiSettings | null;
  rules: StationAiSettingsResponse["rules"] | null;
  busy: boolean;
  onLink: () => void;
  onCancelLink: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Renumber the card to the account WhatsApp Web is logged in as. */
  onUseLinkedPhone: () => void;
}) {
  const linking = station.link !== null;
  // Calls go out from the logged-in account, so a mismatch blocks calling until fixed.
  const wrongAccount = station.linkedPhone !== null && station.linkedPhone !== station.phone;
  const pausable = station.status === "active" || station.status === "paused";
  return (
    <Frame>
      <FramePanel className={cn("space-y-4", busy && "opacity-60")} aria-busy={busy || undefined}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-label-md text-text-strong-950">{station.name}</h3>
              <Badge.Root variant="light" size="medium" color={STATUS_COLOR[station.status]}>{STATUS_LABEL[station.status]}</Badge.Root>
              {station.busyCallId && (
                <Badge.Root variant="light" size="medium" color="blue">
                  <RiLoader4Line className="size-3 animate-spin" aria-hidden="true" />
                  Em ligação
                </Badge.Root>
              )}
              {station.openOn && !station.busyCallId && (
                <Badge.Root variant="light" size="medium" color="green" title={`O WhatsApp Web fica aberto em ${station.openOn}, para que as ligações comecem imediatamente`}>
                  Pronto em {station.openOn}
                </Badge.Root>
              )}
            </div>
            <p className="text-paragraph-sm tabular-nums text-text-sub-600">
              {station.phone} · {LAUNCHER_LABEL[station.launcher]}
              {station.gologinProfileId ? ` · ${station.gologinProfileId}` : ""}
            </p>
            <p className="text-paragraph-xs text-text-soft-400">
              {station.lastSeenAt ? `Worker visto ${timeAgo(station.lastSeenAt)}` : "Nenhum worker abriu ainda"}
              {station.lastCallAt ? ` · última ligação ${timeAgo(station.lastCallAt)}` : ""}
            </p>
            <p className="text-paragraph-xs text-text-sub-600">{station.proxyLabel ? `IP: ${station.proxyLabel}` : "IP próprio"}</p>
            {rules && (
              <p className="text-paragraph-xs text-text-sub-600">
                Campanhas de IA: {ai?.callsPerDay != null ? `${ai.callsPerDay} ligações por dia` : `${rules.callsPerDay} ligações por dia (regra)`} ·{" "}
                {ai?.callingHours ? hoursSummary(ai.callingHours) : "horário de ligações da organização"}
              </p>
            )}
            {station.linkedPhone && (
              <p className={cn("text-paragraph-xs tabular-nums", wrongAccount ? "text-error-base" : "text-text-sub-600")}>
                WhatsApp: conectado como {station.linkedPhone}
                {wrongAccount ? " — não é este número, então não fará ligações" : ""}
              </p>
            )}
            {wrongAccount && (
              <div>
                <Button.Root variant="neutral" mode="stroke" size="xxsmall" disabled={busy} onClick={onUseLinkedPhone}>
                  Usar {station.linkedPhone} como este número
                </Button.Root>
              </div>
            )}
            {station.launcher === "cloak" && (
              <p className="text-paragraph-xs text-text-soft-400">
                {station.profile.savedAt
                  ? `Perfil: salvo ${timeAgo(station.profile.savedAt)}${station.profile.bytes !== null ? ` · ${(station.profile.bytes / 1_000_000).toFixed(1)} MB` : ""} · v${station.profile.version}`
                  : "Perfil: ainda não salvo"}
              </p>
            )}
            {station.lastError && <p className="text-paragraph-xs text-error-base">{station.lastError}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {linking ? (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onCancelLink}>Cancelar vinculação</Button.Root>
            ) : (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy || station.busyCallId !== null} onClick={onLink}>
                <Button.Icon as={RiLinkM} />
                {station.status === "onboarding" ? "Vincular WhatsApp" : "Vincular novamente"}
              </Button.Root>
            )}
            {pausable && (
              <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onToggle}>
                <Button.Icon as={station.status === "paused" ? RiPlayCircleLine : RiPauseCircleLine} />
                {station.status === "paused" ? "Retomar" : "Pausar"}
              </Button.Root>
            )}
            <Button.Root variant="neutral" mode="stroke" size="xsmall" disabled={busy} onClick={onEdit}>
              <Button.Icon as={RiPencilLine} />
              Editar
            </Button.Root>
            <Button.Root variant="error" mode="stroke" size="xsmall" disabled={busy} onClick={onDelete}>
              <Button.Icon as={RiDeleteBinLine} />
              Excluir
            </Button.Root>
          </div>
        </div>
        {station.link && <LinkPanel link={station.link} />}
      </FramePanel>
    </Frame>
  );
}

function ProxyCard({ proxy, onEdit, onDelete }: { proxy: CallingProxy; onEdit: () => void; onDelete: () => void }) {
  const details = [proxy.country, proxy.timezone, proxy.provider].filter(Boolean).join(" · ");
  const assigned = proxy.stationId !== null;
  return (
    <Frame>
      <FramePanel>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-label-md text-text-strong-950">{proxy.label}</h3>
              <Badge.Root variant="light" size="medium" color={assigned ? "blue" : "gray"}>
                {assigned ? `Usado por ${proxy.stationName ?? "um número"}` : "Não atribuído"}
              </Badge.Root>
            </div>
            <p className="font-mono text-paragraph-sm text-text-sub-600">{proxy.protocol}://{proxy.host}:{proxy.port}</p>
            {details && <p className="text-paragraph-xs text-text-soft-400">{details}</p>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button.Root variant="neutral" mode="stroke" size="xsmall" onClick={onEdit}>
              <Button.Icon as={RiPencilLine} />
              Editar
            </Button.Root>
            <Button.Root
              variant="error"
              mode="stroke"
              size="xsmall"
              disabled={assigned}
              title={assigned ? "Desatribua-o do número primeiro" : undefined}
              onClick={onDelete}
            >
              <Button.Icon as={RiDeleteBinLine} />
              Excluir
            </Button.Root>
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

function LinkPanel({ link }: { link: NonNullable<CallingStation["link"]> }) {
  const [zoomed, setZoomed] = useState(false);
  return (
    <div className="space-y-4 rounded-xl bg-bg-weak-50 p-4 ring-1 ring-inset ring-stroke-soft-200">
      <div className="space-y-3">
        <p className="text-label-sm text-text-strong-950">Vincule este número ao WhatsApp Web</p>
        {link.code ? (
          <p
            aria-label={`Código de vinculação ${link.code.split("").join(" ")}`}
            className="w-fit rounded-lg bg-bg-white-0 px-4 py-2 font-mono text-title-h4 tracking-[0.25em] text-text-strong-950 ring-1 ring-inset ring-stroke-soft-200"
          >
            {link.code}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-paragraph-sm text-text-sub-600">
            <RiLoader4Line className="size-4 animate-spin" aria-hidden="true" />
            {link.screenshot ? "Aguardando um código. Se o WhatsApp Web mostrar um QR, escaneie-o." : "Aguardando um worker abrir o WhatsApp Web…"}
          </p>
        )}
        <p className="text-paragraph-sm text-text-sub-600">
          No celular: WhatsApp → Configurações → Dispositivos conectados → Conectar um dispositivo → Conectar com número de telefone, depois digite este código.
        </p>
      </div>
      {link.screenshot && (
        <>
          {/* Full width, so a QR is scannable straight off the screen; click for full size. */}
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Abrir a tela de login do WhatsApp Web em tamanho completo"
            className="block w-full cursor-zoom-in overflow-hidden rounded-lg bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL screenshot from the worker */}
            <img src={link.screenshot} alt="Tela de login do WhatsApp Web no navegador em nuvem" className="block w-full" />
          </button>
          <p className="text-paragraph-xs text-text-soft-400">A captura é atualizada a cada poucos segundos. Clique para abrir em tamanho completo.</p>
          <Modal.Root open={zoomed} onOpenChange={setZoomed}>
            <Modal.Content className="max-w-[min(96vw,1400px)]">
              <Modal.Header>
                <Modal.Title>Tela de login do WhatsApp Web</Modal.Title>
              </Modal.Header>
              <Modal.Body>
                {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL screenshot from the worker */}
                <img src={link.screenshot} alt="Tela de login do WhatsApp Web no navegador em nuvem, em tamanho completo" className="block w-full rounded-lg" />
              </Modal.Body>
            </Modal.Content>
          </Modal.Root>
        </>
      )}
    </div>
  );
}
