import AuditTimeline from "../../app/components/AuditTimeline";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function AuditFeedWidget({ items }) {
  return (
    <Panel>
      <PanelHeader
        kicker="Audit"
        title="Pipeline history"
      />
      <div className="px-5 py-4 sm:px-6">
        <AuditTimeline items={items} />
      </div>
    </Panel>
  );
}
