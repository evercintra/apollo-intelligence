"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDialogs } from "@/components/DialogProvider";

export default function DeleteCampaignButton({ campaignId }: { campaignId: string }) {
  const dialogs = useDialogs();
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (deleting) return;
    const confirmed = await dialogs.confirm({
      title: "Excluir campanha?",
      description:
        "Todos os domínios segmentados, incluindo domínios pai vinculados, serão excluídos junto. Isso não pode ser desfeito.",
      confirmLabel: "Excluir campanha",
      variant: "error",
    });
    if (!confirmed) return;

    setDeleting(true);
    const res = await fetch(`/api/campaigns/${campaignId}`, { method: "DELETE" });
    if (!res.ok) {
      setDeleting(false);
      await dialogs.alert({
        title: "Não foi possível excluir a campanha",
        description: "Algo deu errado. Tente novamente.",
        variant: "error",
      });
      return;
    }
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={deleting}
      className="h-8 rounded-lg border border-[var(--color-error-light)] bg-[var(--color-error-lighter)] px-3 text-xs font-semibold text-[var(--color-error-dark)] disabled:opacity-60 hover:bg-[var(--color-error-light)]"
    >
      {deleting ? "Excluindo..." : "Excluir"}
    </button>
  );
}
