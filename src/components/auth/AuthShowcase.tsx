import Image from "next/image";
import {
  RiArrowRightSLine,
  RiLinkedinBoxFill,
  RiMailFill,
  RiQuillPenLine,
  RiSparkling2Line,
  RiTimeLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { AppIcon } from "@/components/brand/Logo";
import { cn } from "@/utils/cn";

/**
 * The panel beside the auth forms: a photograph, and over it a slice of
 * the product doing its job — the morning's replies from every channel,
 * each already sorted. The table bleeds off the right edge on purpose: it
 * is a window onto the app, not a picture of all of it.
 *
 * Every person and company here is fictional (the same names the demo
 * seed uses). Decorative: hidden from assistive tech.
 *
 * Photo: Marek Piwnicki, https://unsplash.com/photos/w4sxddUJ5-0 — free
 * under the Unsplash License (https://unsplash.com/license).
 */

type Channel = "email" | "linkedin" | "whatsapp";
type Category = "Interested" | "Meeting booked" | "Out of office" | "Not now" | "Referral";

const REPLIES: { name: string; role: string; channel: Channel; reply: string; category: Category; tint: string }[] = [
  { name: "Sana Brennan", role: "Chefe de Operações · Pinecrest Health", channel: "linkedin", reply: "Sim, veio em boa hora. Podemos conversar na quinta-feira?", category: "Interested", tint: "bg-apollo-purple-200 text-apollo-purple-900" },
  { name: "Diego Underhill", role: "VP de Vendas · Harborview Logistics", channel: "email", reply: "Vamos avançar. Quem cuida do contrato?", category: "Meeting booked", tint: "bg-apollo-lime-200 text-apollo-lime-900" },
  { name: "Amara Lindqvist", role: "Líder de RevOps · Tallgrass Energy", channel: "whatsapp", reply: "Envie a apresentação e os preços, por favor.", category: "Interested", tint: "bg-apollo-purple-200 text-apollo-purple-900" },
  { name: "Theo Marlowe", role: "Diretor de CS · Saltmarsh Foods", channel: "email", reply: "Fora até segunda-feira, de volta no dia 14.", category: "Out of office", tint: "bg-apollo-graphite-200 text-apollo-graphite-800" },
  { name: "Hugo Okafor", role: "CRO · Zephyr Cloudworks", channel: "email", reply: "Agendado para terça-feira às 10:00 na sua agenda.", category: "Meeting booked", tint: "bg-apollo-lime-200 text-apollo-lime-900" },
  { name: "Nia Zielinski", role: "Gerente de SDR · Redwood Robotics", channel: "linkedin", reply: "Não neste trimestre. Me chame de novo em janeiro.", category: "Not now", tint: "bg-apollo-graphite-200 text-apollo-graphite-800" },
  { name: "Mei Rasmussen", role: "Gerente de Marketing · Brightloop", channel: "whatsapp", reply: "Encaminhando isto ao nosso chefe de crescimento.", category: "Referral", tint: "bg-apollo-purple-100 text-apollo-purple-900" },
  { name: "Lucas Yilmaz", role: "Fundador · Verdant Learning", channel: "linkedin", reply: "Interessante. Como funciona a integração?", category: "Interested", tint: "bg-apollo-purple-200 text-apollo-purple-900" },
];

const CHANNEL = {
  email: { Icon: RiMailFill, label: "E-mail", className: "text-[#f26b3a]" },
  linkedin: { Icon: RiLinkedinBoxFill, label: "LinkedIn", className: "text-[#0a66c2]" },
  whatsapp: { Icon: RiWhatsappFill, label: "WhatsApp", className: "text-[#1fae55]" },
} satisfies Record<Channel, { Icon: typeof RiMailFill; label: string; className: string }>;

const CATEGORY: Record<Category, string> = {
  Interested: "bg-apollo-lime-100 text-apollo-lime-800 ring-apollo-lime-600/20",
  "Meeting booked": "bg-apollo-purple-100 text-apollo-purple-800 ring-apollo-purple-500/25",
  "Out of office": "bg-apollo-graphite-100 text-apollo-graphite-700 ring-apollo-graphite-400/25",
  "Not now": "bg-apollo-graphite-100 text-apollo-graphite-600 ring-apollo-graphite-400/20",
  Referral: "bg-apollo-soft-white text-apollo-purple-800 ring-apollo-purple-300/40",
};

const CATEGORY_LABEL: Record<Category, string> = {
  Interested: "Interessado",
  "Meeting booked": "Reunião agendada",
  "Out of office": "Fora do escritório",
  "Not now": "Agora não",
  Referral: "Indicação",
};

const CHIPS = [
  { Icon: RiSparkling2Line, label: "Classifique cada resposta" },
  { Icon: RiQuillPenLine, label: "Redija a próxima mensagem" },
  { Icon: RiTimeLine, label: "Acompanhe no prazo" },
];

/** Lead, channel, category, reply: the reply runs off the right edge. */
const COLUMNS = "grid grid-cols-[220px_112px_150px_1fr]";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

/** Glass on the photograph: the status line above the table and the chips below it. */
const glass = "border border-apollo-soft-white/15 bg-apollo-graphite-950/40 text-apollo-soft-white shadow-[inset_0_1px_0_rgb(246_242_250/0.08)] backdrop-blur-md";

export function AuthShowcase({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative h-full w-full overflow-hidden rounded-[28px] bg-apollo-graphite-950", className)}>
      <Image src="/auth/blue-light.webp" alt="" fill sizes="50vw" className="object-cover object-[50%_35%]" />
      {/* Settle the photo so the white table reads cleanly against it. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />

      {/* Status line, table and chips: one column, centred, bleeding off the right edge. */}
      <div className="absolute inset-y-0 left-[8%] right-0 flex flex-col justify-center gap-6 py-10">
        <div className={cn(glass, "flex items-center gap-2.5 self-start rounded-full py-1.5 pl-1.5 pr-3 text-[13px]")}>
          <AppIcon small className="size-6" />
          <span className="font-medium">Apollo Intelligence classificou 24 respostas durante a noite</span>
          <RiArrowRightSLine className="size-4 text-apollo-soft-white/60" />
        </div>

        <div className="w-[max(780px,100%)] shrink-0 overflow-hidden rounded-xl bg-apollo-soft-white text-apollo-graphite-900 shadow-[0_30px_80px_-20px_rgb(15_18_14/0.7),0_0_0_1px_rgb(246_242_250/0.4)]">
          <div className="flex items-center gap-3 border-b border-apollo-graphite-200/80 px-5 py-3.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">Respostas</span>
            <span className="text-[13px] text-apollo-graphite-500">24 novas hoje</span>
            <div className="ml-6 flex gap-1 text-[12px] font-medium">
              <span className="rounded-md bg-apollo-graphite-900 px-2 py-1 text-apollo-soft-white">Todas</span>
              <span className="rounded-md px-2 py-1 text-apollo-graphite-500">Interessadas 9</span>
              <span className="rounded-md px-2 py-1 text-apollo-graphite-500">Reuniões 3</span>
            </div>
          </div>
          <div className={cn(COLUMNS, "border-b border-apollo-graphite-200/80 bg-apollo-graphite-50 px-5 py-2 text-[12px] font-medium text-apollo-graphite-500")}>
            <span>Lead</span>
            <span>Canal</span>
            <span>Categoria</span>
            <span>Resposta</span>
          </div>
          <div className="relative">
            {REPLIES.map((r) => {
              const ch = CHANNEL[r.channel];
              return (
                <div key={r.name} className={cn(COLUMNS, "items-center border-b border-apollo-graphite-100 px-5 py-2.5 text-[13px] last:border-b-0")}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", r.tint)}>{initials(r.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium leading-tight">{r.name}</span>
                      <span className="block truncate text-[11.5px] leading-tight text-apollo-graphite-500">{r.role}</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-apollo-graphite-600">
                    <ch.Icon className={cn("size-4", ch.className)} />
                    {ch.label}
                  </span>
                  <span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", CATEGORY[r.category])}>{CATEGORY_LABEL[r.category]}</span>
                  </span>
                  <span className="truncate pr-5 text-apollo-graphite-700">{r.reply}</span>
                </div>
              );
            })}
            {/* The list carries on below the fold. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-apollo-soft-white/0 to-apollo-soft-white" />
          </div>
          <div className="flex items-center gap-3 border-t border-apollo-graphite-200/80 bg-apollo-graphite-50 px-5 py-2.5 text-[12px] text-apollo-graphite-500">
            <span>
              <span className="font-medium text-apollo-graphite-800">24</span> classificadas
            </span>
            <span className="h-3 w-px bg-apollo-graphite-300" />
            <span>
              <span className="font-medium text-apollo-graphite-800">9</span> rascunhos prontos
            </span>
            <span className="h-3 w-px bg-apollo-graphite-300" />
            <span>
              <span className="font-medium text-apollo-graphite-800">3</span> reuniões agendadas
            </span>
          </div>
        </div>

        <div className="flex gap-2.5 whitespace-nowrap">
          {CHIPS.map(({ Icon, label }) => (
            <span key={label} className={cn(glass, "flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[15px] font-medium")}>
              <Icon className="size-[18px] text-apollo-lime-300" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
