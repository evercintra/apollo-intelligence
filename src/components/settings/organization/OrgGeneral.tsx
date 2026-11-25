"use client";

import { useEffect, useState, type FormEvent } from "react";
import * as Button from "@/components/alignui/button";
import * as Input from "@/components/alignui/input";
import { Frame, FrameFooter, FrameHeader, FramePanel } from "@/components/analytics/kit/Frame";
import { useDialogs } from "@/components/DialogProvider";
import { Callout, Field } from "@/components/settings/SettingsKit";
import { authClient } from "@/lib/auth/client";
import { useAsyncAction, orgRoleLabel, useOrgAccess } from "./useOrgAccess";

function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function OrgGeneral() {
  const { org, role, loading, error: loadError, can, reload } = useOrgAccess();
  const dialogs = useDialogs();
  const { busy, error, setError, run } = useAsyncAction();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logo, setLogo] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    // Seed the form once the organization arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(org.name);
    setSlug(org.slug);
    setLogo(org.logo ?? "");
  }, [org]);

  if (loading) return <p className="text-paragraph-sm text-text-sub-600">Carregando…</p>;
  if (!org || !role) return <Callout tone="error">{loadError || "Nenhuma organização ativa."}</Callout>;

  const canEdit = can({ organization: ["update"] });
  const dirty = name.trim() !== org.name || slugify(slug) !== org.slug || logo.trim() !== (org.logo ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaved(false);
    const finalSlug = slugify(slug);
    if (!name.trim() || !finalSlug) return setError("O nome e o nome da URL são obrigatórios.");
    if (finalSlug !== org.slug) {
      const check = await authClient.organization.checkSlug({ slug: finalSlug });
      if (check.error || !check.data?.status) return setError("Esse nome da URL já está em uso. Tente outro.");
    }
    const ok = await run("save", () =>
      authClient.organization.update({
        organizationId: org.id,
        data: { name: name.trim(), slug: finalSlug, logo: logo.trim() || undefined },
      }),
    );
    if (ok) {
      // Refresh in place: a full page reload would turn the settings pop-up into the
      // standalone /settings page. The sidebar's Better Auth atoms refetch on their own
      // after /organization/update.
      await reload();
      setSaved(true);
    }
  }

  async function leave() {
    if (!org) return;
    const confirmed = await dialogs.confirm({
      title: `Sair de ${org.name}?`,
      description: "Você perderá o acesso aos leads, campanhas e conversas até que alguém o convide novamente.",
      confirmLabel: "Sair da organização",
      variant: "error",
    });
    if (!confirmed) return;
    const ok = await run("leave", () => authClient.organization.leave({ organizationId: org.id }));
    if (ok) window.location.assign("/onboarding");
  }

  return (
    <div className="flex flex-col gap-6">
      <Frame>
        <FrameHeader title="Organização" description={`Sua função: ${orgRoleLabel(role)}`} />
        <FramePanel>
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field label="Nome" htmlFor="org-name" required>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field label="Nome da URL" htmlFor="org-slug" description="Letras minúsculas, números e hífens." required>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            <Field label="URL do logo" htmlFor="org-logo" optional>
              <Input.Root size="medium">
                <Input.Wrapper>
                  <Input.Input id="org-logo" type="url" placeholder="https://" value={logo} onChange={(e) => setLogo(e.target.value)} disabled={!canEdit} />
                </Input.Wrapper>
              </Input.Root>
            </Field>
            {error && <Callout tone="error">{error}</Callout>}
            {saved && <Callout tone="success">Salvo.</Callout>}
            {canEdit ? (
              <div>
                <Button.Root type="submit" variant="primary" mode="filled" size="small" disabled={!dirty || busy === "save"}>
                  {busy === "save" ? "Salvando…" : "Salvar alterações"}
                </Button.Root>
              </div>
            ) : (
              <p className="text-paragraph-xs text-text-sub-600">Apenas proprietários e administradores podem alterar estes dados.</p>
            )}
          </form>
        </FramePanel>
        <FrameFooter>Todos na organização veem os mesmos leads, campanhas e conversas.</FrameFooter>
      </Frame>

      {role !== "owner" && (
        <Frame>
          <FrameHeader title="Sair da organização" description="Remova você desta organização." />
          <FramePanel className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-paragraph-sm text-text-sub-600">Você pode ser convidado de volta a qualquer momento.</p>
            <Button.Root variant="error" mode="stroke" size="small" disabled={busy === "leave"} onClick={leave}>
              {busy === "leave" ? "Saindo…" : "Sair da organização"}
            </Button.Root>
          </FramePanel>
        </Frame>
      )}
    </div>
  );
}
