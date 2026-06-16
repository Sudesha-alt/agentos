import PipelineExplorerWidget from "../../widgets/pipeline-explorer/PipelineExplorerWidget";
import { PageIntro } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export default function Pipelines() {
  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Pipeline Explorer"
        title="What do I need to do next?"
      />
      <PipelineExplorerWidget />
    </AnimatedAppPage>
  );
}
