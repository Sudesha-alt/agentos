import { Link } from "react-router-dom";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export default function OrgNotFound() {
  const { orgPath } = useOrg();

  return (
    <AnimatedAppPage>
      <div className="mx-auto max-w-lg rounded-app border border-app-border bg-app-surface px-6 py-10 text-center shadow-app-card">
        <p className="type-kicker">Not found</p>
        <h1 className="mt-2 text-lg font-semibold text-app-ink">This page does not exist</h1>
        <p className="mt-2 text-[14px] text-app-ink-dim">
          The route may be outdated or mistyped. Return to your workspace dashboard.
        </p>
        <Link
          to={orgPath()}
          className="mt-6 inline-flex rounded-app-sm bg-indigo px-4 py-2 text-[13px] font-medium text-white hover:bg-indigo/90"
        >
          Back to dashboard
        </Link>
      </div>
    </AnimatedAppPage>
  );
}
