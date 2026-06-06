import { Panel, PanelHeader } from "../../shared/ui/Panel";
import CodebaseSearchCore from "./CodebaseSearchCore";

export default function CodebaseSearchPanel({ branch = "main" }) {
  return (
    <Panel>
      <PanelHeader
        kicker="Search & Ask"
        title="Find code by meaning"
        body="Semantic file search plus pattern tag matches. Switch to Ask for guided answers with file citations."
      />
      <div className="px-5 py-5 sm:px-6">
        <CodebaseSearchCore branch={branch} />
      </div>
    </Panel>
  );
}
