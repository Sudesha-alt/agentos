import { Link } from "react-router-dom";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { AGENT_NAMES } from "../../shared/config/app";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function GitHubIntegrationOverviewWidget({ embedded = false }) {
  const { data, error, loading } = useGitIntegrationSummary({ pollMs: 12000 });

  const connected = Boolean(data?.connected);
  const needsRepoSelection = Boolean(data?.needsRepoSelection);
  const installationDetected = Boolean(data?.installationDetected);
  const repoLabel = data?.repoLabel;

  const body = (
      <div className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 sm:px-6"}>
        {loading && !data ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Git integration API unreachable. Start the server with{" "}
            <code className="font-mono text-[12px] text-ink">npm run dev</code> in{" "}
            <code className="font-mono text-[12px] text-ink">server/</code> and configure{" "}
            <code className="font-mono text-[12px] text-ink">GITHUB_APP_*</code> or connect
            via PAT.
          </p>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              {repoLabel
                ? `Repository · ${repoLabel}`
                : needsRepoSelection || installationDetected
                  ? "GitHub App installed — select a repository on the Git page"
                  : data?.githubAppConfigured
                    ? "GitHub App ready — install to pick a repository"
                    : "Not connected · install GitHub App or use PAT"}
            </p>
            {data?.authMethod ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                Auth · {data.authMethod === "github_app" ? "GitHub App" : data.authMethod}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4 text-[13px]">
              <Link
                to="/app/settings/integrations/github"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Open GitHub integration →
              </Link>
              <Link
                to="/app/codebase"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                {AGENT_NAMES.ANANTA} →
              </Link>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="min-w-0 overflow-hidden rounded-app-sm border border-app-border bg-app-surface-muted/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
            GitHub
          </p>
          <LabelPill
            label={
              connected
                ? "Connected"
                : needsRepoSelection || installationDetected
                  ? "Select repo"
                  : "Not connected"
            }
            tone={
              connected ? "success" : needsRepoSelection || installationDetected ? "warning" : "muted"
            }
          />
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="GitHub"
        title="Repository connection"
        right={
          <LabelPill
            label={
              connected
                ? "Connected"
                : needsRepoSelection || installationDetected
                  ? "Select repo"
                  : "Not connected"
            }
            tone={
              connected ? "success" : needsRepoSelection || installationDetected ? "warning" : "muted"
            }
          />
        }
      />
      {body}
    </Panel>
  );
}
