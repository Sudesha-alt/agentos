import { Link } from "react-router-dom";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function GitHubIntegrationOverviewWidget({ embedded = false }) {
  const { data, error, loading } = useGitIntegrationSummary({ pollMs: 12000 });

  const connected = Boolean(data?.connected);
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
                to="/app/git"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Open GitHub integration →
              </Link>
              <Link
                to="/app/codebase"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Codebase intelligence →
              </Link>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="rounded-[1rem] border border-hairline bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            GitHub
          </p>
          <LabelPill
            label={connected ? "Connected" : "Not connected"}
            tone={connected ? "success" : "muted"}
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
        body="Codebase indexing, branch push, pull requests, and QA sandbox clones."
        right={
          <LabelPill
            label={connected ? "Connected" : "Not connected"}
            tone={connected ? "success" : "muted"}
          />
        }
      />
      {body}
    </Panel>
  );
}
