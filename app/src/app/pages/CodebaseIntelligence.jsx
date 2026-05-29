import CodebaseVisualization from "../../features/codebase-viz/CodebaseVisualization";
import { PageIntro } from "../../shared/ui/Panel";

export default function CodebaseIntelligence() {
  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-6">
      <PageIntro
        kicker="Codebase Intelligence"
        title="A living map of understanding"
        body="Five toggleable layers — structure, relationships, activity, quality, and AI-generated meaning. Built for seniors scanning heat and interns taking the guided tour."
      />
      <CodebaseVisualization />
    </div>
  );
}
