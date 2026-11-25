export type InboxSectionKey = "inbox" | "sent" | "replied" | "scheduled" | "important" | "outOfOffice" | "pendingApproval";

export const INBOX_SECTIONS: { key: InboxSectionKey; label: string; parent?: InboxSectionKey }[] = [
  { key: "inbox", label: "Caixa de entrada" },
  { key: "replied", label: "Respondidas", parent: "inbox" },
  { key: "outOfOffice", label: "Ausência", parent: "inbox" },
  { key: "pendingApproval", label: "Aguardando aprovação" },
  { key: "sent", label: "Enviados" },
  { key: "important", label: "Importantes" },
  { key: "scheduled", label: "Agendados" },
];

/** What each folder's count means, for its tooltip. `/api/outreach/inbox/counts` only reports these three. */
export const SECTION_COUNT_HINT: Partial<Record<InboxSectionKey, string>> = {
  inbox: "não lidas",
  important: "marcadas",
  scheduled: "aguardando envio",
};
