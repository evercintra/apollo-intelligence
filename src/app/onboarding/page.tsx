"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authClient, useListOrganizations, useSession } from "@/lib/auth/client";
import { slugify } from "@/lib/auth/slug";
import { AuthShell } from "@/components/auth/AuthShell";
import { ErrorCallout, Field, SecondaryButton, SubmitButton } from "@/components/auth/fields";

export default function OnboardingPage() {
  const { data: session, isPending } = useSession();
  const { data: orgs } = useListOrganizations();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!isPending && !session) window.location.href = "/sign-in?from=/onboarding";
  }, [isPending, session]);

  function onName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setError("");
    const finalSlug = slugify(slug);
    if (!name.trim() || !finalSlug) return setError("Informe um nome para sua organização.");
    setLoading(true);
    const check = await authClient.organization.checkSlug({ slug: finalSlug });
    if (check.error || !check.data?.status) {
      setError("Esse nome de URL já está em uso. Tente outro.");
      return setLoading(false);
    }
    const created = await authClient.organization.create({ name: name.trim(), slug: finalSlug });
    if (created.error || !created.data) {
      setError(created.error?.message || "Não foi possível criar a organização.");
      return setLoading(false);
    }
    const active = await authClient.organization.setActive({ organizationId: created.data.id });
    if (active.error) {
      setError(active.error.message || "Organização criada, mas não foi possível acessá-la. Recarregue a página e tente novamente.");
      return setLoading(false);
    }
    window.location.assign("/analytics");
  }

  async function switchTo(id: string) {
    setError("");
    setSwitching(id);
    const { error: err } = await authClient.organization.setActive({ organizationId: id });
    if (err) {
      setError(err.message || "Não foi possível trocar de organização.");
      return setSwitching(null);
    }
    window.location.assign("/analytics");
  }

  const hasOrgs = !!orgs && orgs.length > 0;

  return (
    <AuthShell
      title={hasOrgs ? "Escolha uma organização" : "Crie sua organização"}
      subtitle={hasOrgs ? "Escolha uma para continuar ou crie outra." : "Seu espaço para leads, prospecção e conversas."}
    >
      <div className="flex flex-col gap-4">
        {hasOrgs && (
          <div className="flex flex-col gap-2">
            {orgs.map((o) => (
              <SecondaryButton key={o.id} onClick={() => switchTo(o.id)} loading={switching === o.id} disabled={!!switching}>
                {o.name}
              </SecondaryButton>
            ))}
            <div className="mt-2 text-xs uppercase tracking-widest text-apollo-graphite-400">Ou crie uma nova</div>
          </div>
        )}
        <form onSubmit={create} className="flex flex-col gap-4">
          <Field label="Nome da organização" type="text" autoComplete="organization" required value={name} onChange={(e) => onName(e.target.value)} />
          <Field
            label="Nome da URL"
            type="text"
            autoComplete="off"
            required
            hint="Letras minúsculas, números e hífens."
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value);
            }}
          />
          {error && <ErrorCallout>{error}</ErrorCallout>}
          <SubmitButton loading={loading} loadingLabel="Criando..." disabled={!!switching}>
            Criar organização
          </SubmitButton>
        </form>
      </div>
    </AuthShell>
  );
}
