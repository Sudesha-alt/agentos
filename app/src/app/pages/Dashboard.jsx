import CommandCenterWidget from "../../widgets/command-center/CommandCenterWidget";
import { PageIntro } from "../../shared/ui/Panel";

export default function Dashboard() {
  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-8">
      <PageIntro
        kicker="Command Center"
        title="What is happening right now"
        body="Five metrics, live activity, and cycle-time trend — built for engineering leadership, not agent debug logs."
      />
      <CommandCenterWidget />
    </div>
  );
}
