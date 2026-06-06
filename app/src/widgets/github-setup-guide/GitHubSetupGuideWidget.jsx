import { useState } from "react";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function GitHubSetupGuideWidget({
  connected,
  webhookUrl,
  githubApp,
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Panel>
      <PanelHeader
        kicker="Setup guide"
        title="How to connect GitHub"
        body="Follow these steps once per environment. Credentials are stored on the server after you connect."
        right={
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
          >
            {open ? "Hide guide" : "Show guide"}
          </button>
        }
      />

      {open ? (
        <div className="space-y-6 px-5 py-5 sm:px-6">
          <GuideSection number="0" title="Before you start (deploy / local)">
            <ul className="list-disc space-y-2 pl-5 text-[14px] leading-relaxed text-ink-dim">
              <li>
                <strong className="text-ink">API must be reachable over HTTPS</strong> for
                GitHub webhooks. On Render set{" "}
                <code className="font-mono text-[12px] text-indigo">PUBLIC_API_URL</code> to
                your API URL.
              </li>
              <li>
                Set{" "}
                <code className="font-mono text-[12px] text-indigo">FRONTEND_URL</code> on the
                server so GitHub App install redirects back to this app.
              </li>
              <li>
                On Vercel set{" "}
                <code className="font-mono text-[12px] text-indigo">VITE_API_URL</code> to the
                same API URL so this page can talk to the server.
              </li>
              <li>
                Local dev: run{" "}
                <code className="font-mono text-[12px]">npm run tunnel</code> in{" "}
                <code className="font-mono text-[12px]">server/</code> and use that HTTPS URL
                as <code className="font-mono text-[12px]">PUBLIC_API_URL</code>.
              </li>
            </ul>
          </GuideSection>

          <GuideSection number="1" title="Create a GitHub App">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              Register an app under your org or personal account with repository permissions
              for contents, pull requests, metadata, webhooks, and actions (read).
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Go to{" "}
                <a
                  href="https://github.com/settings/apps/new"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo underline"
                >
                  GitHub → Settings → Developer settings → GitHub Apps → New
                </a>
                .
              </li>
              <li>
                Set callback and webhook URLs from step 2 below. Enable{" "}
                <strong className="text-ink">push</strong> and{" "}
                <strong className="text-ink">pull_request</strong> events.
              </li>
              <li>
                Copy the App ID, private key, and slug into{" "}
                <code className="font-mono text-[12px]">GITHUB_APP_ID</code>,{" "}
                <code className="font-mono text-[12px]">GITHUB_APP_PRIVATE_KEY</code>, and{" "}
                <code className="font-mono text-[12px]">GITHUB_APP_SLUG</code> on Render.
              </li>
            </ol>
          </GuideSection>

          <GuideSection number="2" title="Callback & webhook URLs">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              Paste these into your GitHub App settings (Setup URL / Callback URL and Webhook
              URL).
            </p>
            {githubApp?.installUrl ? (
              <p className="mt-2 rounded-[0.85rem] border border-hairline bg-canvas/40 px-3 py-2 font-mono text-[11px] text-indigo break-all">
                Install URL: {githubApp.installUrl}
              </p>
            ) : null}
            {webhookUrl ? (
              <p className="mt-2 rounded-[0.85rem] border border-hairline bg-canvas/40 px-3 py-2 font-mono text-[11px] text-indigo break-all">
                Webhook URL: {webhookUrl}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-ink-mute">
                Webhook URL appears here after{" "}
                <code className="font-mono text-[12px]">PUBLIC_API_URL</code> is set and you
                load this page.
              </p>
            )}
            <p className="mt-3 text-[13px] text-ink-mute">
              Webhook secret env:{" "}
              <code className="font-mono text-[12px]">GITHUB_APP_WEBHOOK_SECRET</code>
            </p>
          </GuideSection>

          <GuideSection number="3" title="One-click connect">
            <ol className="list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Click <strong className="text-ink">Connect with GitHub</strong> below to
                install the app on your org or account.
              </li>
              <li>
                After redirect, pick the repository AgentOS should index and push to.
              </li>
              <li>
                Push and pull request webhooks are managed by the GitHub App — no manual repo
                webhook setup.
              </li>
            </ol>
            {!githubApp?.configured ? (
              <p className="mt-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-[13px] text-ink-dim">
                GitHub App env vars are not set on the server. Complete step 1 or use manual
                PAT fallback below.
              </p>
            ) : null}
          </GuideSection>

          <GuideSection number="4" title="Manual PAT fallback">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              If the GitHub App is not configured, expand{" "}
              <strong className="text-ink">Manual token (fallback)</strong> below and provide
              owner, repository name, and a personal access token with{" "}
              <code className="font-mono text-[12px]">repo</code> scope.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Create a token at{" "}
                <a
                  href="https://github.com/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo underline"
                >
                  GitHub → Settings → Developer settings → Personal access tokens
                </a>
                .
              </li>
              <li>Enter owner, repo, and token in the advanced panel on this page.</li>
              <li>
                Register the webhook URL from step 2 in the repository settings if not using
                the GitHub App.
              </li>
            </ol>
          </GuideSection>

          {connected ? (
            <p className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-[13px] text-ink-dim">
              You are connected. Use the panels below to reconfigure the installation or
              switch repositories.
            </p>
          ) : (
            <p className="rounded-xl border border-indigo/25 bg-indigo/5 px-4 py-3 text-[13px] text-ink-dim">
              Start with the GitHub App connect button, or use manual PAT if env vars are not
              set yet.
            </p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

function GuideSection({ number, title, children }) {
  return (
    <section>
      <h3 className="font-display text-[1.15rem] tracking-tight text-ink">
        <span className="font-mono text-[11px] text-indigo">{number}.</span> {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}
