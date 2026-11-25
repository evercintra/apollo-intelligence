"use client";

import { useEffect } from "react";
import Link from "next/link";
import * as Badge from "@/components/alignui/badge";
import * as Checkbox from "@/components/alignui/checkbox";
import type { AiCampaignGoal, AiContactStatus } from "@/lib/calls/aiCampaigns/contract";
import type { AiCampaignState } from "@/lib/calls/aiCampaigns/api";
import type { AgentOutcomeKind, AgentVoiceId } from "@/lib/calls/contract";
import { elevenLabsVoiceLabel, type ElevenLabsVoice } from "@/lib/calls/elevenlabs/contract";
import type { CallingStation, StationStatus } from "@/lib/calls/stationContract";
import { cn } from "@/utils/cn";

type BadgeColor = React.ComponentProps<typeof Badge.Root>["color"];

export const AI_STATUS_LABELS_PT: Record<AiContactStatus, string> = {
  queued: "Na fila",
  reaching: "Abordando",
  callback: "Retorno agendado",
  chasing: "Aguardando agendamento",
  booked: "Reunião agendada",
  handoff: "Para a equipe",
  not_interested: "Não interessado",
  unreached: "Não abordado",
  replied: "Respondeu",
  stopped: "Interrompido",
  failed: "Falhou",
};
export const AI_STATE_LABELS_PT: Record<AiCampaignState, string> = { draft: "Rascunho", active: "Ativa", paused: "Pausada" };
export const AI_GOAL_TEXT_PT: Record<AiCampaignGoal, { label: string; help: string }> = {
  book_meeting: {
    label: "Agendar reunião",
    help: "Se estiverem interessados, o agente se compromete a enviar um link de agendamento pelo WhatsApp; os follow-ups continuam até a pessoa agendar.",
  },
  human_callback: {
    label: "Passar para a equipe",
    help: "Se estiverem interessados, o agente confirma e informa quando alguém da sua equipe vai ligar; o lead vai para Ação necessária.",
  },
  either: {
    label: "Qualquer uma, a critério deles",
    help: "O agente oferece o link de agendamento ou uma ligação da equipe, se a pessoa preferir.",
  },
};
export const AI_OUTCOME_LABELS_PT: Record<AgentOutcomeKind, string> = {
  meeting_booked: "Reunião combinada",
  interested: "Interessado",
  human_callback: "Quer que a equipe ligue",
  call_back: "Ligar de volta",
  not_interested: "Não interessado",
  wrong_person: "Pessoa errada",
  do_not_contact: "Não contatar",
  no_response: "Sem resposta",
  other: "Outro",
};
export const AGENT_VOICE_LABELS_PT: Record<AgentVoiceId, string> = {
  Kore: "Kore — firme, feminina",
  Aoede: "Aoede — leve, feminina",
  Leda: "Leda — jovem, feminina",
  Sulafat: "Sulafat — calorosa, feminina",
  Despina: "Despina — suave, feminina",
  Puck: "Puck — animada, masculina",
  Charon: "Charon — informativa, masculina",
  Achird: "Achird — amigável, masculina",
};
export function elevenLabsVoiceLabelPt(voice: ElevenLabsVoice): string {
  return elevenLabsVoiceLabel(voice)
    .replace(/\bfemale\b/gi, "feminina")
    .replace(/\bmale\b/gi, "masculina")
    .replace(/\byoung\b/gi, "jovem")
    .replace(/\bold\b/gi, "madura")
    .replace(/\bcalm\b/gi, "calma")
    .replace(/\bdeep\b/gi, "grave")
    .replace(/\benergetic\b/gi, "enérgica")
    .replace(/\bfriendly\b/gi, "amigável")
    .replace(/\bprofessional\b/gi, "profissional")
    .replace(/\bwarm\b/gi, "calorosa")
    .replace(/\bbright\b/gi, "viva");
}
export const AI_MESSAGE_FIELD_LABELS_PT: Record<string, string> = {
  firstName: "Primeiro nome",
  company: "Empresa",
  agentName: "Nome do agente",
  bookingLink: "Link de agendamento",
};
const AI_STEP_LABELS_PT: Record<string, string> = {
  "Reach them": "Abordar",
  "Chasing the booking": "Aguardando agendamento",
  "Booking link": "Link de agendamento",
  "They called back": "Eles ligaram de volta",
  "AI call from the lead page": "Ligação com IA pela página do lead",
};
export function aiStepLabelPt(label: string): string {
  const chased = label.endsWith(" (chasing the booking)") ? " (aguardando agendamento)" : "";
  const core = label.replace(/\s*\(chasing the booking\)$/, "");
  const call = /^Call (\d+) of (\d+)$/.exec(core);
  if (call) return `Ligação ${call[1]} de ${call[2]}${chased}`;
  const message = /^Message (\d+) of (\d+)$/.exec(core);
  if (message) return `Mensagem ${message[1]} de ${message[2]}${chased}`;
  const callback = /^Call back (\d+)$/.exec(core);
  if (callback) return `Ligar de volta ${callback[1]}`;
  return AI_STEP_LABELS_PT[core] ?? label;
}
const AI_ERRORS_PT: Record<string, string> = {
  "Campaign not found": "Campanha não encontrada",
  "Choose at least one calling number": "Escolha pelo menos um número para ligações",
  "Add at least one call to the sequence": "Adicione pelo menos uma ligação à sequência",
  "Write the campaign instructions (what every call is about)": "Escreva as instruções da campanha (sobre o que cada ligação vai falar)",
  "Add the booking link, or set the goal to hand over to the team": "Adicione o link de agendamento ou defina o objetivo como passar para a equipe",
  "Add at least one lead": "Adicione pelo menos um lead",
  "Choose what the calls are for": "Escolha o objetivo das ligações",
  "Could not load ElevenLabs voices": "Não foi possível carregar as vozes da ElevenLabs",
  "Could not load your Cal.com links": "Não foi possível carregar seus links do Cal.com",
  "Could not load numbers": "Não foi possível carregar os números",
  "Could not save the sequence": "Não foi possível salvar a sequência",
  "Could not save the settings": "Não foi possível salvar as configurações",
  "Could not save the numbers": "Não foi possível salvar os números",
  "The booking link must be an https:// address": "O link de agendamento deve ser um endereço https://",
  "The booking message must include {{bookingLink}}": "A mensagem de agendamento deve incluir {{bookingLink}}",
  "The sequence must be a list of steps": "A sequência deve ser uma lista de etapas",
  "Add at least one step": "Adicione pelo menos uma etapa",
  "Choose at least one step": "Escolha pelo menos uma etapa",
};
export function aiErrorPt(message: string): string {
  if (AI_ERRORS_PT[message]) return AI_ERRORS_PT[message]!;
  return message
    .replace(/^Reach them: /, "Abordar: ")
    .replace(/^If they said yes but haven't booked: /, "Se disseram que sim mas não agendaram: ")
    .replace(/^Instructions must be at most (\d+) characters$/, "As instruções devem ter no máximo $1 caracteres")
    .replace(/^The booking message must be at most (\d+) characters$/, "A mensagem de agendamento deve ter no máximo $1 caracteres")
    .replace(/^Call-backs must be between 0 and (\d+)$/, "Os retornos devem ficar entre 0 e $1")
    .replace(/^At most (\d+) steps$/, "No máximo $1 etapas")
    .replace(/^Step (\d+) is not a step$/, "A etapa $1 não é uma etapa válida")
    .replace(/^Step (\d+) has an invalid id$/, "A etapa $1 tem um id inválido")
    .replace(/^Step (\d+) repeats an id$/, "A etapa $1 repete um id")
    .replace(/^Step (\d+): the wait must be between 0 and (\d+) hours$/, "A etapa $1: a espera deve ficar entre 0 e $2 horas")
    .replace(/^Step (\d+): instructions must be at most (\d+) characters$/, "A etapa $1: as instruções devem ter no máximo $2 caracteres")
    .replace(/^Step (\d+): the message is empty$/, "A etapa $1: a mensagem está vazia")
    .replace(/^Step (\d+): the message is over (\d+) characters$/, "A etapa $1: a mensagem passa de $2 caracteres")
    .replace(/^Step (\d+) must be a call or a message$/, "A etapa $1 deve ser uma ligação ou uma mensagem");
}
const AI_NOTES_PT: Record<string, string> = {
  "Not on WhatsApp": "Sem WhatsApp",
  "Browser crashed": "O navegador travou",
  "Asked to be called back": "Pediu para ligar de volta",
  "Booking link sent": "Link de agendamento enviado",
  "Do Not Contact": "Não contatar",
  "Did not pick up the call-back; trying again tomorrow": "Não atendeu o retorno; tentando novamente amanhã",
  "Agreed to a meeting; sending the booking link": "Combinou uma reunião; enviando o link de agendamento",
  "Wrong person": "Pessoa errada",
  "Has a vendor": "Já tem um fornecedor",
  "Asked about pricing": "Perguntou sobre preços",
};
export function aiNotePt(note: string): string {
  if (AI_NOTES_PT[note]) return AI_NOTES_PT[note]!;
  return note
    .replace(/^Call back: (.+)$/, "Retorno: $1")
    .replace(/^Stopped by (.+)$/, "Interrompido por $1")
    .replace(/^The booking link could not be sent: (.+)$/, "Não foi possível enviar o link de agendamento: $1");
}

export const AI_STATUS_COLOR: Record<AiContactStatus, BadgeColor> = {
  queued: "gray",
  reaching: "blue",
  callback: "sky",
  chasing: "purple",
  booked: "green",
  handoff: "teal",
  not_interested: "gray",
  unreached: "yellow",
  replied: "sky",
  stopped: "orange",
  failed: "red",
};

export function AiStatusBadge({ status }: { status: AiContactStatus }) {
  return (
    <Badge.Root size="small" variant="lighter" color={AI_STATUS_COLOR[status]} className="whitespace-nowrap">
      <Badge.Dot />
      {AI_STATUS_LABELS_PT[status]}
    </Badge.Root>
  );
}

const STATE_COLOR: Record<AiCampaignState, BadgeColor> = { draft: "gray", active: "green", paused: "orange" };

export function AiCampaignStateBadge({ state, size = "medium" }: { state: AiCampaignState; size?: "small" | "medium" }) {
  return (
    <Badge.Root size={size} variant="lighter" color={STATE_COLOR[state]} className="shrink-0">
      <Badge.Dot />
      {AI_STATE_LABELS_PT[state]}
    </Badge.Root>
  );
}

/** Marks a campaign the AI agent runs on its own. */
export function AiAgentBadge() {
  return (
    <Badge.Root size="small" variant="light" color="purple" className="shrink-0">
      Agente de IA
    </Badge.Root>
  );
}

export function errorText(cause: unknown, fallback = "Algo deu errado. Tente novamente."): string {
  return cause instanceof Error ? cause.message : fallback;
}

/** Asks the browser to confirm leaving the page while `dirty`. */
export function useBeforeUnload(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}

const STATION_LABEL: Record<StationStatus, string> = {
  onboarding: "Ainda não vinculado",
  active: "Ativa",
  paused: "Pausada",
  logged_out: "Desconectada",
  banned: "Bloqueada",
};
const STATION_COLOR: Record<StationStatus, BadgeColor> = { onboarding: "gray", active: "green", paused: "orange", logged_out: "red", banned: "red" };

/** The calling numbers a campaign may place its calls from. Only active or still-onboarding numbers can be chosen. */
export function NumberPicker({
  stations,
  selectedIds,
  onChange,
  error,
  disabled,
}: {
  stations: CallingStation[] | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  error?: string | null;
  disabled?: boolean;
}) {
  if (stations === null) {
    return <p className="rounded-xl bg-bg-weak-50 p-3 text-paragraph-sm text-text-sub-600">{error ?? "Carregando números…"}</p>;
  }
  if (stations.length === 0) {
    return (
      <p className="rounded-xl bg-warning-lighter p-3 text-paragraph-sm text-warning-dark">
        Ainda não há números para ligações.{" "}
        <Link href="/settings/whatsapp-stations" className="underline">Adicione um em Configurações → WhatsApp → Números para ligações</Link>
        , vincule-o ao WhatsApp Web e volte depois. Você ainda pode salvar esta campanha como rascunho.
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {stations.map((station) => {
        const checked = selectedIds.includes(station.id);
        const usable = station.status === "active" || station.status === "onboarding";
        return (
          <label
            key={station.id}
            className={cn(
              "flex items-center gap-3 rounded-xl p-3 ring-1 ring-inset transition",
              usable && !disabled ? "cursor-pointer" : "cursor-not-allowed opacity-60",
              checked ? "bg-bg-weak-50 ring-primary-base" : "ring-stroke-soft-200",
              usable && !checked && !disabled && "hover:bg-bg-weak-50",
            )}
          >
            <Checkbox.Root
              checked={checked}
              disabled={disabled || (!usable && !checked)}
              onCheckedChange={() => onChange(checked ? selectedIds.filter((id) => id !== station.id) : [...selectedIds, station.id])}
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-label-sm text-text-strong-950">{station.name}</span>
              <span className="block truncate text-paragraph-xs tabular-nums text-text-sub-600">{station.phone}</span>
              <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge.Root size="small" variant="light" color={STATION_COLOR[station.status]}>{STATION_LABEL[station.status]}</Badge.Root>
                {station.openOn && (
                  <Badge.Root size="small" variant="light" color="green" title={`O WhatsApp Web fica aberto em ${station.openOn}, então as ligações começam na hora`}>
                    Pronto em {station.openOn}
                  </Badge.Root>
                )}
                {station.status === "onboarding" && (
                  <span className="text-paragraph-xs text-text-soft-400">Vincule o WhatsApp antes de lançar</span>
                )}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "Action required from Nov 6, 1:13 PM", or "In Action required since …" once due. */
export function actionRequiredText(iso: string): string {
  const due = new Date(iso).getTime() <= Date.now();
  return `${due ? "Na Ação necessária desde" : "Ação necessária a partir de"} ${formatWhen(iso)}`;
}

export function formatCallLength(ms: number | null): string | null {
  if (!ms || ms < 1000) return null;
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
