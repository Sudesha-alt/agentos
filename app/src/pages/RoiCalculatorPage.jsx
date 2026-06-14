import { Link } from "react-router-dom";
import Logo from "../components/Logo";
import { Panel, PanelHeader } from "../shared/ui/Panel";
import RoiCalculatorPanel from "../widgets/roi-calculator/RoiCalculatorPanel";

export default function RoiCalculatorPage() {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-hairline/80 px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Logo href="/" />
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-ink-dim transition hover:text-ink">
              Sign in
            </Link>
            <Link
              to="/contact"
              className="rounded-full border border-hairline px-4 py-2 text-sm text-ink-dim transition hover:border-indigo/40 hover:text-ink"
            >
              Contact sales
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="editorial-kicker text-ink-mute">ROI</p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          Estimate your annual savings
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-dim">
          Model how AgentOS pays for itself across Product, Engineering, and QA agents.
          Tune team size, pipeline volume, and rework — then compare tiers.
        </p>

        <div className="app-theme app-shell-gradient mt-8 rounded-app border border-hairline/40 shadow-app-card">
          <Panel>
            <PanelHeader
              kicker="Calculator"
              title="Estimated ROI by plan"
              body="Defaults assume a 10-person team at $150/hr blended rate. Assumptions are documented in the panel."
            />
            <RoiCalculatorPanel initialPlanId="growth" publicMode />
          </Panel>
        </div>
      </main>
    </div>
  );
}
