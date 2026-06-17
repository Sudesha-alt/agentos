import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraSetupGuide({
  connected,
  webhookUrl,
  baseUrl,
  defaultOpen = true,
}) {
  const orgPath = useOrgPathBuilder();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Panel>
      <PanelHeader
        kicker="Setup guide"
        title="How to get credentials and connect Jira"
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
                Jira webhooks. On Render set{" "}
                <code className="font-mono text-[12px] text-indigo">PUBLIC_API_URL</code> to
                your API URL (e.g.{" "}
                <code className="font-mono text-[12px]">https://your-app.onrender.com</code>
                ).
              </li>
              <li>
                On Vercel set{" "}
                <code className="font-mono text-[12px] text-indigo">VITE_API_URL</code> to the
                same API URL so this page can talk to the server.
              </li>
              <li>
                Local dev: run{" "}
                <code className="font-mono text-[12px]">npm run tunnel</code> in{" "}
                <code className="font-mono text-[12px]">server/</code> (ngrok) and use that
                HTTPS URL as <code className="font-mono text-[12px]">PUBLIC_API_URL</code>.
              </li>
              <li>
                Optional: set <code className="font-mono text-[12px]">JIRA_*</code> in{" "}
                <code className="font-mono text-[12px]">server/.env</code> to pre-fill the form
                on startup.
              </li>
            </ul>
          </GuideSection>

          <GuideSection number="1" title="Jira site URL (Base URL)">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              This is your Atlassian Cloud site — the same URL you use to open Jira in the
              browser.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>Open Jira in your browser.</li>
              <li>
                Copy the origin only — no path after the host. Example:{" "}
                <code className="font-mono text-[12px] text-indigo">
                  https://your-company.atlassian.net
                </code>
              </li>
              <li>Paste it into the <strong className="text-ink">Base URL</strong> field below.</li>
            </ol>
          </GuideSection>

          <GuideSection number="2" title="API token (required)">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              Jira uses an API token instead of your password. Create one for the account that
              can read the board and (for webhooks) manage site settings.
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Go to{" "}
                <a
                  href="https://id.atlassian.com/manage-profile/security/api-tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo underline"
                >
                  Atlassian → Security → API tokens
                </a>
                .
              </li>
              <li>Click <strong className="text-ink">Create API token</strong>, name it e.g. AgentOS.</li>
              <li>Copy the token immediately — you will not see it again.</li>
              <li>Paste it into the <strong className="text-ink">API token</strong> field below.</li>
            </ol>
            <p className="mt-3 text-[13px] text-ink-mute">
              Tip: use a service account or bot user if your org requires separation from
              personal accounts.
            </p>
          </GuideSection>

          <GuideSection number="3" title="Service email (optional)">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              Must match the Atlassian account that owns the API token. If you leave this blank
              and click <strong className="text-ink">Connect Jira</strong>, we call Jira&apos;s{" "}
              <code className="font-mono text-[12px]">/myself</code> API and fill it for you.
            </p>
          </GuideSection>

          <GuideSection number="4" title="Board ID">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              The numeric ID of the Scrum/Kanban board you want the AI Worker column on.
            </p>
            <p className="mt-2 font-medium text-ink">Option A — Board search (easiest)</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Open{" "}
                <Link to={orgPath("jira-search")} className="text-indigo underline">
                  Board search
                </Link>{" "}
                in this app (after base URL + token are set on the server or in the form).
              </li>
              <li>Search by project name, pick a board, copy the ID shown.</li>
            </ol>
            <p className="mt-4 font-medium text-ink">Option B — From Jira URL</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                In Jira go to <strong className="text-ink">Boards</strong> → your board.
              </li>
              <li>
                Open board settings or use REST:{" "}
                <code className="font-mono text-[11px] break-all">
                  GET /rest/agile/1.0/board
                </code>
              </li>
              <li>
                The ID is the number in URLs like{" "}
                <code className="font-mono text-[12px]">/boards/123</code> or the{" "}
                <code className="font-mono text-[12px]">id</code> field in the API response.
              </li>
            </ol>
          </GuideSection>

          <GuideSection number="5" title="Connect in this app">
            <ol className="list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Fill <strong className="text-ink">Base URL</strong>,{" "}
                <strong className="text-ink">API token</strong>, and{" "}
                <strong className="text-ink">Board ID</strong>.
              </li>
              <li>
                Click <strong className="text-ink">Connect Jira</strong>. We verify the board,
                save credentials on the server, and generate a webhook secret.
              </li>
              <li>
                If your account is a <strong className="text-ink">Jira site admin</strong>, we
                also try to register the webhook in Jira automatically.
              </li>
            </ol>
          </GuideSection>

          <GuideSection number="6" title="Webhook (Jira → AgentOS)">
            <p className="text-[14px] leading-relaxed text-ink-dim">
              Jira must send events to your API when issues are created or updated.
            </p>
            {webhookUrl ? (
              <p className="mt-2 rounded-[0.85rem] border border-hairline bg-canvas/40 px-3 py-2 font-mono text-[11px] text-indigo">
                Your webhook URL: {webhookUrl}
              </p>
            ) : (
              <p className="mt-2 text-[13px] text-ink-mute">
                The webhook URL appears here after the server has{" "}
                <code className="font-mono text-[12px]">PUBLIC_API_URL</code> set and you load
                this page.
              </p>
            )}
            <p className="mt-3 font-medium text-ink">Automatic (recommended)</p>
            <p className="mt-1 text-[14px] text-ink-dim">
              After connect, click <strong className="text-ink">Register webhook in Jira</strong>{" "}
              or rely on auto-register during connect. Requires Jira admin permission.
            </p>
            <p className="mt-4 font-medium text-ink">Manual</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                In Jira: <strong className="text-ink">Settings (⚙) → System → Webhooks</strong>
                {baseUrl ? (
                  <>
                    {" "}
                    or{" "}
                    <a
                      href={`${baseUrl.replace(/\/$/, "")}/plugins/servlet/webhooks`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo underline"
                    >
                      open webhooks for your site
                    </a>
                  </>
                ) : null}
                .
              </li>
              <li>
                Create webhook → paste the <strong className="text-ink">Webhook URL</strong> from
                step 2 below.
              </li>
              <li>
                Enable event: <strong className="text-ink">Issue updated</strong> only (
                <code className="font-mono text-[12px]">jira:issue_updated</code>).
              </li>
              <li>
                If you set a webhook secret on the server (
                <code className="font-mono text-[12px]">PIPELINE_JIRA_WEBHOOK_SECRET</code>
                ), paste the <strong className="text-ink">same value</strong> in Jira&apos;s{" "}
                <strong className="text-ink">Secret</strong> field. Jira signs deliveries with{" "}
                <code className="font-mono text-[12px]">X-Hub-Signature</code> — do not use a
                custom header (Jira Cloud admin webhooks do not support that).
              </li>
              <li>
                Leave the Secret field empty in Jira only if the server has no webhook secret
                configured.
              </li>
            </ol>
          </GuideSection>

          <GuideSection number="7" title="Columns and working queue">
            <ol className="list-decimal space-y-2 pl-5 text-[14px] text-ink-dim">
              <li>
                Choose <strong className="text-ink">Working column</strong> (where tickets are
                picked up) and <strong className="text-ink">Next column</strong> (Advance target).
              </li>
              <li>Save column mapping.</li>
              <li>
                Move a Jira issue into the working column, or click{" "}
                <strong className="text-ink">Sync from Jira</strong>.
              </li>
              <li>
                Creating a new issue in Jira (with webhook working) also starts the agent{" "}
                <strong className="text-ink">pipeline</strong> on{" "}
                <code className="font-mono text-[12px]">issue_created</code>.
              </li>
            </ol>
          </GuideSection>

          {connected ? (
            <p className="rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-[13px] text-ink-dim">
              You are connected. Use the steps below to adjust webhook, columns, or the working
              queue.
            </p>
          ) : (
            <p className="rounded-xl border border-indigo/25 bg-indigo/5 px-4 py-3 text-[13px] text-ink-dim">
              Start with steps 1–5 in the form below. If anything fails, check{" "}
              <code className="font-mono text-[12px]">PUBLIC_API_URL</code>, HTTPS, and that the
              API token has access to the board.
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
