import { Link } from "react-router-dom";
import LabelPill from "../../../app/components/LabelPill";
import { useIntegrationsStatus } from "../../../shared/hooks/useIntegrationsStatus";
import IntegrationsOverviewWidget from "../../../widgets/integrations-overview/IntegrationsOverviewWidget";
import { Panel, PanelHeader } from "../../../shared/ui/Panel";

const STATUS_META = {
  connected: { label: "Connected", tone: "success", cta: "Configure" },
  setup_incomplete: { label: "Select repository", tone: "warning", cta: "Finish setup" },
  not_connected: { label: "Not connected", tone: "muted", cta: "Connect" },
  coming_soon: { label: "Coming soon", tone: "indigo", cta: "Learn more" },
};

function IntegrationIcon({ integration }) {
  if (integration.icon) {
    return (
      <img
        src={integration.icon}
        alt=""
        className="size-10 rounded-app border border-app-border bg-white object-contain p-1.5"
      />
    );
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-app border border-app-border bg-app-surface-muted text-sm font-semibold text-app-ink">
      {integration.name.slice(0, 1)}
    </div>
  );
}

function IntegrationCard({ integration }) {
  const meta = STATUS_META[integration.displayStatus] ?? STATUS_META.not_connected;
  const detailPath = integration.route ?? `/app/settings/integrations/${integration.id}`;

  return (
    <Link
      to={detailPath}
      className="group flex h-full flex-col rounded-app border border-app-border bg-app-surface-muted/20 p-4 transition-[border-color,box-shadow,transform] duration-300 ease-out hover:-translate-y-px hover:border-indigo/30 hover:bg-indigo/5 hover:shadow-app-card"
    >
      <div className="flex items-start justify-between gap-3">
        <IntegrationIcon integration={integration} />
        <LabelPill label={meta.label} tone={meta.tone} />
      </div>
      <h3 className="mt-4 text-[15px] font-medium text-app-ink">{integration.name}</h3>
      <p className="mt-2 flex-1 text-[13px] leading-relaxed text-app-ink-dim">
        {integration.description}
      </p>
      <p className="mt-4 text-[11px] font-medium text-indigo transition group-hover:text-indigo/80">
        {meta.cta} →
      </p>
    </Link>
  );
}

export default function SettingsIntegrationsPage() {
  const { grouped } = useIntegrationsStatus();

  return (
    <div className="space-y-5">
      <IntegrationsOverviewWidget />

      <Panel>
        <PanelHeader
          kicker="Catalog"
          title="Integrations"
          body="Connect source control, issue trackers, databases, and observability tools to power your agent pipeline."
        />
        <div className="space-y-8 p-5 sm:p-6">
          {grouped.map((section) => (
            <section key={section.id}>
              <h3 className="type-kicker">{section.label}</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((integration) => (
                  <IntegrationCard key={integration.id} integration={integration} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </Panel>
    </div>
  );
}
