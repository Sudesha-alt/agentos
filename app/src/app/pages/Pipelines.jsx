import PipelineExplorerWidget from "../../widgets/pipeline-explorer/PipelineExplorerWidget";
import { PageIntro } from "../../shared/ui/Panel";

export default function Pipelines() {
  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Pipeline Explorer"
        title="What do I need to do next?"
        body="Air-traffic view: active runs, review queue, and history — with detail panel that keeps your place in the list."
      />
      <PipelineExplorerWidget />
    </div>
  );
}
