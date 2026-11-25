"use client";

import { useState, useSyncExternalStore } from "react";
import { RiChromeLine, RiDownload2Line, RiRefreshLine } from "@remixicon/react";
import * as Badge from "@/components/alignui/badge";
import * as Button from "@/components/alignui/button";
import { Frame, FramePanel } from "@/components/analytics/kit/Frame";
import { DocsLink } from "@/components/page/DocsLink";
import { isRecorderInstalled, recorderVersion, sendToRecorder } from "@/lib/calls/client";
import { RECORDER_INSTALLED_ATTRIBUTE } from "@/lib/calls/contract";
import {
  isOlderVersion,
  LATEST_RECORDER_VERSION,
  RECORDER_DOWNLOAD_PATH,
  RECORDER_SELF_UPDATE_VERSION,
} from "@/lib/calls/recorderRelease";
import { errorMessage } from "@/components/crm/crm-utils";

type Installed = { state: "checking" } | { state: "missing" } | { state: "installed"; version: string | null };

/** The extension marks the page, and marks it again with its new version after an update. */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: [RECORDER_INSTALLED_ATTRIBUTE] });
  return () => observer.disconnect();
}
/** The installed version ("" when unreadable), null when missing; undefined on the server. */
const readVersion = () => (isRecorderInstalled() ? (recorderVersion() ?? "") : null);
const readOnServer = () => undefined;

/**
 * The Call Recorder extension: which version this browser runs against the
 * one this deployment serves, the download, and how to install or update it.
 * It is loaded unpacked, so Chrome never updates it on its own.
 */
export function RecorderExtensionCard() {
  const version = useSyncExternalStore(subscribe, readVersion, readOnServer);
  const installed: Installed =
    version === undefined ? { state: "checking" } : version === null ? { state: "missing" } : { state: "installed", version: version || null };

  const outdated =
    installed.state === "installed" && (!installed.version || isOlderVersion(installed.version, LATEST_RECORDER_VERSION));
  // 0.14.0 and later install an update themselves; older copies are replaced by hand once.
  const canSelfUpdate =
    installed.state === "installed" && Boolean(installed.version) && !isOlderVersion(installed.version!, RECORDER_SELF_UPDATE_VERSION);
  const [updateError, setUpdateError] = useState("");

  const openUpdater = async () => {
    setUpdateError("");
    try {
      const reply = await sendToRecorder({ type: "recorder:update" });
      if (reply.type === "recorder:update-rejected") setUpdateError(reply.error);
    } catch (cause) {
      setUpdateError(errorMessage(cause));
    }
  };

  return (
    <Frame>
      <FramePanel className="flex flex-col gap-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-inset ring-stroke-soft-200">
              <RiChromeLine className="size-5 text-text-sub-600" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-label-md text-text-strong-950">Extensão de gravação de chamadas</h3>
                {installed.state === "missing" && (
                  <Badge.Root size="medium" variant="lighter" color="gray">Não instalada neste navegador</Badge.Root>
                )}
                {installed.state === "installed" && outdated && (
                  <Badge.Root size="medium" variant="lighter" color="orange">
                    Atualização disponível{installed.version ? ` · você está na ${installed.version}` : ""}
                  </Badge.Root>
                )}
                {installed.state === "installed" && !outdated && (
                  <Badge.Root size="medium" variant="lighter" color="green">Atualizada</Badge.Root>
                )}
              </div>
              <p className="mt-1 text-paragraph-sm text-text-sub-600">
                Faz ligações do WhatsApp pelo Apollo Intelligence e as grava. Apenas Chrome, carregada sem empacotamento.
              </p>
              <p className="mt-1 text-paragraph-xs text-text-soft-400">Versão mais recente: {LATEST_RECORDER_VERSION}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {outdated ? (
              <DocsLink page="whatsapp/calling#update-the-extension">Como atualizar</DocsLink>
            ) : (
              <DocsLink page="whatsapp/calling#install-the-extension">{installed.state === "missing" ? "Como instalar" : "Guia de configuração"}</DocsLink>
            )}
            {outdated && canSelfUpdate ? (
              <Button.Root variant="primary" mode="filled" size="small" onClick={() => void openUpdater()}>
                <Button.Icon as={RiRefreshLine} />
                Atualizar
              </Button.Root>
            ) : (
              <Button.Root
                asChild
                variant={outdated || installed.state === "missing" ? "primary" : "neutral"}
                mode={outdated || installed.state === "missing" ? "filled" : "stroke"}
                size="small"
              >
                <a href={RECORDER_DOWNLOAD_PATH} download>
                  <Button.Icon as={RiDownload2Line} />
                  Baixar
                </a>
              </Button.Root>
            )}
          </div>
        </div>
        {updateError && <p className="text-paragraph-sm text-error-base">{updateError}</p>}

        <div className="grid gap-4 border-t border-stroke-soft-200 pt-4 text-paragraph-sm text-text-sub-600 sm:grid-cols-2">
          <div>
            <p className="text-label-sm text-text-strong-950">Primeira vez</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Baixe e descompacte o arquivo.</li>
              <li>
                Mova a pasta <Code>agentsdr-call-recorder</Code> para um local fixo, como Documentos.
              </li>
              <li>
                Abra <Code>chrome://extensions</Code>, ative o modo desenvolvedor, clique em Carregar sem compactação e escolha essa pasta.
              </li>
            </ol>
          </div>
          <div>
            <p className="text-label-sm text-text-strong-950">Para atualizar</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Clique em Atualizar. A extensão baixa a versão nova e recarrega a si mesma.</li>
              <li>
                Na primeira vez, ela pede a pasta: a que aparece em Origem em <Code>chrome://extensions</Code> → Detalhes. Permita
                que o Chrome a edite.
              </li>
              <li>Recarregue o WhatsApp Web antes da próxima ligação.</li>
            </ol>
            <p className="mt-2 text-paragraph-xs text-text-soft-400">
              Versões anteriores a {RECORDER_SELF_UPDATE_VERSION} não têm o botão Atualizar: substitua a pasta por um download novo
              e clique na seta de recarregar em <Code>chrome://extensions</Code>.
            </p>
          </div>
        </div>
      </FramePanel>
    </Frame>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-bg-weak-50 px-1 py-0.5 text-paragraph-xs text-text-strong-950">{children}</code>;
}
