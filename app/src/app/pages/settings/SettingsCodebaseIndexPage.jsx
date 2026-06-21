import { useState } from "react";
import { Link } from "react-router-dom";
import { useGitIntegrationSetup } from "../../../entities/git-integration";
import { useCodebaseLayerStatus } from "../../../entities/codebase";
import CodebaseIntelligenceStatusWidget from "../../../widgets/codebase-intelligence-status/CodebaseIntelligenceStatusWidget";
import IndexProgressBar from "../../../widgets/index-progress/IndexProgressBar";
import { Panel, PanelHeader } from "../../../shared/ui/Panel";
import { useOrg } from "../../../shared/providers/OrgRouteProvider";

const VECTOR_CONFIG = [
  { label: "Embedding provider", value: "OpenAI" },
  { label: "Embedding model", value: "text-embedding-3-small (1536 dimensions)" },
  { label: "Vector store", value: "Supabase pgvector · codebase_embeddings + vector_store" },
  { label: "Chunk strategy", value: "tree-sitter AST (function/class boundaries)" },
  { label: "Chunk budget", value: "~2,048 tokens / ~8,192 chars (CODEBASE_CHUNK_MAX_TOKENS)" },
  { label: "Max chunks per file", value: "16" },
];

export default function SettingsCodebaseIndexPage() {
  const { orgPath } = useOrg();
  const { data: setup } = useGitIntegrationSetup({ pollMs: 30000 });
  const gitBranch = setup?.git?.defaultBranch ?? "main";
  const { data: layerStatus } = useCodebaseLayerStatus({ branch: gitBranch, pollMs: 12000 });
  const branch = layerStatus?.repo?.defaultBranch ?? gitBranch;
  const [indexRunId, setIndexRunId] = useState(null);

  return (
    <div className="space-y-5">
      <div>
        <p className="type-kicker">Configuration</p>
        <h2 className="mt-1 text-lg font-semibold text-app-ink">Codebase indexing</h2>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-app-ink-dim">
          Indexing runs in the background after you connect GitHub. Agents use these vectors for
          semantic code search — this is not shown in the Ananta workspace UI.
        </p>
        <p className="mt-2 text-[13px] text-app-ink-dim">
          <Link to={orgPath("settings", "integrations", "github")} className="text-indigo hover:underline">
            GitHub integration →
          </Link>
          {" · "}
          <Link to={orgPath("settings", "integrations", "jira")} className="text-indigo hover:underline">
            Jira vector index →
          </Link>
          {" · "}
          connect and select a repository before indexing.
        </p>
      </div>

      <CodebaseIntelligenceStatusWidget
        branch={branch}
        showReindex
        onIndexStarted={({ runId }) => setIndexRunId(runId)}
      />

      {(setup?.connected || indexRunId) && (
        <IndexProgressBar
          runId={indexRunId ?? undefined}
          branch={branch}
          enabled={Boolean(setup?.connected || indexRunId)}
        />
      )}

      <Panel>
        <PanelHeader
          kicker="Vectorization"
          title="Where embeddings are created and stored"
          info="Read-only in this release. Configure OpenAI and Supabase via server environment variables."
        />
        <dl className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          {VECTOR_CONFIG.map((row) => (
            <div key={row.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-app-ink-mute">
                {row.label}
              </dt>
              <dd className="mt-1 text-[14px] text-app-ink">{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-app-border px-5 py-4 sm:px-6">
          <p className="text-[13px] text-app-ink-dim">Connection health</p>
          <ul className="mt-2 space-y-1 text-[13px]">
            <li className={layerStatus?.configuration?.openaiConfigured ? "text-success" : "text-warning"}>
              OpenAI {layerStatus?.configuration?.openaiConfigured ? "configured" : "not configured"}
            </li>
            <li className={(layerStatus?.counts?.embeddings ?? 0) > 0 ? "text-success" : "text-app-ink-dim"}>
              {(layerStatus?.counts?.embeddings ?? 0).toLocaleString()} embeddings stored
            </li>
            {layerStatus?.counts?.filesIndexed ? (
              <li className="text-app-ink-dim">
                Codebase index health: {layerStatus.counts.indexHealthPercent ?? 0}% (
                {layerStatus.counts.embeddings} embeddings / {layerStatus.counts.filesIndexed} files)
              </li>
            ) : null}
            {layerStatus?.jira?.connected ? (
              <li
                className={
                  (layerStatus.jira.embedded ?? 0) > 0 ? "text-success" : "text-app-ink-dim"
                }
              >
                Jira embed health: {layerStatus.jira.embedHealthPercent ?? 0}% (
                {layerStatus.jira.embedded ?? 0} / {layerStatus.jira.total ?? 0} issues)
              </li>
            ) : null}
            {layerStatus?.index?.lastTrigger ? (
              <li className="text-app-ink-dim">
                Last indexed from{" "}
                {layerStatus.index.lastTrigger === "pr_merge"
                  ? `PR merge${layerStatus.index.lastPrNumber ? ` #${layerStatus.index.lastPrNumber}` : ""}`
                  : layerStatus.index.lastTrigger}
                {layerStatus.index.lastIndexedAt
                  ? ` · ${new Date(layerStatus.index.lastIndexedAt).toLocaleString()}`
                  : ""}
              </li>
            ) : null}
            {(layerStatus?.counts?.filesSkippedOversized ?? 0) > 0 ? (
              <li className="text-warning">
                {layerStatus.counts.filesSkippedOversized} files skipped (size limit)
              </li>
            ) : null}
            {(layerStatus?.blockers ?? []).length > 0 ? (
              <li className="text-warning">
                Blockers: {layerStatus.blockers.join(" · ")}
              </li>
            ) : null}
          </ul>
        </div>
      </Panel>
    </div>
  );
}
