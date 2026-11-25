"use client";

import * as Badge from "@/components/alignui/badge";
import { draftRecipientView } from "@/lib/crm/draftRecipients";

/**
 * The To and Cc an email draft goes out with, above its subject, so whoever
 * approves it sees who receives it — above all when the thread handed us to a
 * new point of contact and the draft goes to them with the Person copied.
 */
export function DraftRecipients({ draft, personEmail }: {
  draft: { toEmail?: unknown; ccEmails?: unknown };
  personEmail: string | null;
}) {
  const view = draftRecipientView({
    toEmail: typeof draft.toEmail === "string" ? draft.toEmail : null,
    ccEmails: Array.isArray(draft.ccEmails) ? draft.ccEmails.filter((item): item is string => typeof item === "string") : null,
  }, personEmail);
  if (!view.to) {
    return <p className="text-paragraph-xs text-error-base">Esta pessoa não tem e-mail, então a resposta não pode ser enviada por e-mail.</p>;
  }
  return (
    <div className="space-y-1 rounded-lg bg-bg-weak-50 px-3 py-2 ring-1 ring-inset ring-stroke-soft-200">
      <Row label="Para">
        <span className="truncate text-text-strong-950" title={view.to}>{view.to}</span>
        {view.redirected && <Badge.Root variant="lighter" size="small" color="purple" className="shrink-0">Novo contato</Badge.Root>}
      </Row>
      {view.cc.length > 0 && (
        <Row label="Cc">
          <span className="truncate text-text-sub-600" title={view.cc.join(", ")}>{view.cc.join(", ")}</span>
        </Row>
      )}
      {view.redirected && (
        <p className="text-paragraph-xs text-text-sub-600">
          A conversa passou para um novo contato, então esta mensagem vai para ele com {personEmail} em cópia. Para enviar a {personEmail}, regenere e diga isso.
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-paragraph-sm">
      <span className="w-6 shrink-0 text-label-xs text-text-sub-600">{label}</span>
      {children}
    </div>
  );
}
