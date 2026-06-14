import LandingDashboardWidget from "../../widgets/landing-dashboard/LandingDashboardWidget";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export default function Dashboard() {
  return (
    <AnimatedAppPage className="space-y-6">
      <header>
        <p className="type-kicker">Workspace</p>
        <h1 className="mt-1 type-page-title">Dashboard</h1>
        <p className="mt-2 type-page-lede max-w-2xl">
          Is everything okay? Five numbers, one review queue, and live activity — scannable
          in under ten seconds.
        </p>
      </header>
      <LandingDashboardWidget />
    </AnimatedAppPage>
  );
}
