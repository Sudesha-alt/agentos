import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import LabelPill from "../../../app/components/LabelPill";
import { getIntegrationById } from "../../../shared/config/integrationsCatalog";
import { useIntegrationsStatus } from "../../../shared/hooks/useIntegrationsStatus";
import { Panel, PanelHeader } from "../../../shared/ui/Panel";

const NOTIFY_KEY_PREFIX = "agentos.integrationNotify.";

export default function SettingsIntegrationDetailPage() {
  const { integrationId } = useParams();
  const { integrations } = useIntegrationsStatus();
  const live = integrations.find((item) => item.id === integrationId);

  if (integrationId === "github") {
    return <Navigate to="/app/settings/integrations/github" replace />;
  }
  if (integrationId === "jira") {
    return <Navigate to="/app/settings/integrations/jira" replace />;
  }

  const integration = getIntegrationById(integrationId);
  if (!integration) {
    return <Navigate to="/app/settings/integrations" replace />;
  }

  return (
    <ComingSoonIntegration
      integration={integration}
      displayStatus={live?.displayStatus ?? "coming_soon"}
    />
  );
}

function ComingSoonIntegration({ integration, displayStatus }) {
  const [notified, setNotified] = useState(() => {
    try {
      return localStorage.getItem(`${NOTIFY_KEY_PREFIX}${integration.id}`) === "true";
    } catch {
      return false;
    }
  });

  function handleNotify() {
    try {
      localStorage.setItem(`${NOTIFY_KEY_PREFIX}${integration.id}`, "true");
    } catch {
      /* ignore */
    }
    setNotified(true);
  }

  const statusMeta =
    displayStatus === "coming_soon"
      ? { label: "Coming soon", tone: "indigo" }
      : displayStatus === "setup_incomplete"
        ? { label: "Select repository", tone: "warning" }
        : displayStatus === "connected"
          ? { label: "Connected", tone: "success" }
          : { label: "Not connected", tone: "muted" };
  return (
    <div className="space-y-5">
      <Link
        to="/app/settings/integrations"
        className="inline-flex text-[13px] text-app-ink-dim transition hover:text-indigo"
      >
        ← Back to integrations
      </Link>

      <Panel>
        <PanelHeader
          kicker="Integration"
          title={integration.name}
          info={integration.description}
          right={<LabelPill label={statusMeta.label} tone={statusMeta.tone} />}
        />
        <div className="space-y-6 p-5 sm:p-6">
          <div className="rounded-app border border-app-border bg-app-surface-muted/30 p-5">
            <h3 className="text-[15px] font-medium text-app-ink">What to expect</h3>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-app-ink-dim">
              <li>• Secure OAuth or API key connection from this settings page</li>
              <li>• Workspace-scoped credentials with audit logging</li>
              <li>• Pipeline hooks so agents can read and write through {integration.name}</li>
              <li>• Health checks and reconnect flows in the integrations hub</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleNotify}
              disabled={notified}
              className="rounded-full border border-indigo/30 bg-indigo/10 px-4 py-2 text-[13px] font-medium text-indigo transition hover:bg-indigo/15 disabled:cursor-default disabled:opacity-70"
            >
              {notified ? "You’re on the list" : "Notify me when available"}
            </button>
            <a
              href="mailto:sales@agentos.dev?subject=Integration%20request"
              className="rounded-full border border-app-border px-4 py-2 text-[13px] font-medium text-app-ink-dim transition hover:border-indigo/30 hover:text-app-ink"
            >
              Contact sales
            </a>
          </div>
        </div>
      </Panel>
    </div>
  );
}
