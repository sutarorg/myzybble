import { requireAuthContext } from "@/server/auth";
import { integrationStatus } from "@/server/services/settings";
import { SectionTitle, Card, Badge } from "@/components/app/primitives";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

export const metadata = { title: "Integrations" };

export default async function IntegrationsSettingsPage() {
  const ctx = await requireAuthContext();
  const integrations = await integrationStatus(ctx.workspaceId);

  return (
    <div className="space-y-6">
      <SectionTitle sub="Configuration status for each provider. Keys and secrets are server-only and never shown here.">
        Integrations
      </SectionTitle>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-lg font-bold tracking-tight">
                  {integration.label}
                </h3>
                <p className="mt-1 text-sm text-ink/55">{integration.detail}</p>
              </div>
              {integration.configured ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-lime" />
              ) : (
                <AlertCircle className="h-5 w-5 shrink-0 text-amber-500" />
              )}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Badge tone={integration.configured ? "lime" : "amber"}>
                {integration.configured ? "configured" : "not configured"}
              </Badge>
              {integration.docsUrl.startsWith("/") ? (
                <a
                  href={integration.docsUrl}
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink"
                >
                  Open <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <a
                  href={integration.docsUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-xs font-medium text-ink/60 hover:text-ink"
                >
                  Provider console <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="font-display text-lg font-bold tracking-tight">Adding credentials</h2>
        <p className="mt-1.5 text-sm text-ink/60">
          Secrets are set as environment variables on the deployment — never in code, and never in a
          file committed to the repository. See{" "}
          <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-xs">.env.example</code> for
          the full list and which environment each one belongs to.
        </p>
        <ul className="mt-4 space-y-1.5 text-sm text-ink/65">
          <li>
            • <strong>Vercel</strong> — Project Settings → Environment Variables (separate values for
            Development / Preview / Production).
          </li>
          <li>
            • <strong>Railway</strong> — Service → Variables for the scraper worker.
          </li>
          <li>
            • <strong>Supabase</strong> — Project Settings → API for the URL, anon key and service
            role key.
          </li>
        </ul>
      </Card>
    </div>
  );
}
