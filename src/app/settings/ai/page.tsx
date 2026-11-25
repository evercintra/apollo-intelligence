import ByokSettingsClient from "@/components/ai/ByokSettingsClient";
import { PlatformConnection } from "@/components/settings/PlatformConnection";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { requirePageOrgContext } from "@/lib/auth/context";
import { listPlatformStatus } from "@/lib/platform/credentials";
import { runInOrganization } from "@/lib/tenancy/scope";

export const metadata = { title: "Provedor de IA" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const ctx = await requirePageOrgContext();
  const statuses = await runInOrganization(ctx.organizationId, () => listPlatformStatus());
  return (
    <SettingsPage title="Provedor de IA" description="A conexão OpenRouter e os modelos usados por todos os recursos de IA, e onde ficam seus prompts e traces.">
      <ByokSettingsClient>
        <section className="flex flex-col gap-3 pt-4">
          <div>
            <h3 className="text-label-md text-text-strong-950">Prompts e rastreamento (Langfuse)</h3>
            <p className="mt-1 max-w-2xl text-paragraph-sm text-text-sub-600">
              Opcional, e salvo separadamente. Conecte um projeto Langfuse para editar lá os prompts da IA e ver cada chamada feita por ela. Sem isso, os recursos de IA usam os prompts integrados do Apollo Intelligence e nada é rastreado.
            </p>
          </div>
          <PlatformConnection platformKey="langfuse" status={statuses.find((status) => status.key === "langfuse") ?? null} />
        </section>
        <section className="flex flex-col gap-3 pt-4">
          <div>
            <h3 className="text-label-md text-text-strong-950">Agente de voz (ElevenLabs)</h3>
            <p className="mt-1 max-w-2xl text-paragraph-sm text-text-sub-600">
              Opcional. Conecte a ElevenLabs para testar o agente telefônico ao lado do Gemini em uma campanha de IA (Comparar vozes). O Apollo Intelligence configura o agente na sua própria conta da ElevenLabs.
            </p>
          </div>
          <PlatformConnection platformKey="elevenlabs" status={statuses.find((status) => status.key === "elevenlabs") ?? null} />
        </section>
      </ByokSettingsClient>
    </SettingsPage>
  );
}
