import LandingDashboardWidget from "../../widgets/landing-dashboard/LandingDashboardWidget";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { PageIntro } from "../../shared/ui/Panel";

export default function Dashboard() {
  return (
    <AnimatedAppPage className="space-y-6">
      <PageIntro kicker="Workspace" title="Dashboard" />
      <LandingDashboardWidget />
    </AnimatedAppPage>
  );
}
