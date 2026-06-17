import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ESTIMATOR_PLANS,
  PLAN_FEATURE_MATRIX,
  computeMonthlyCostEstimate,
  formatEstimatorMoney,
} from "../../shared/billing/monthlyCostEstimate";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

export default function DashboardCostEstimator({ variant = "dashboard" }) {
  const orgPath = useOrgPathBuilder();
  const isMarketing = variant === "marketing";
  const [planId, setPlanId] = useState("starter");
  const [businessScale, setBusinessScale] = useState(4);

  const estimate = useMemo(
    () => computeMonthlyCostEstimate({ planId, businessScale }),
    [planId, businessScale]
  );

  const selectedPlan = ESTIMATOR_PLANS.find((p) => p.id === planId) ?? ESTIMATOR_PLANS[1];

  return (
    <Panel>
      {!isMarketing ? (
        <PanelHeader
          kicker="Pricing"
          title="Estimate your monthly cost"
        />
      ) : null}

      <div className="space-y-8 px-5 py-6 sm:px-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
            1 · Choose your plan
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {ESTIMATOR_PLANS.map((plan) => {
              const active = plan.id === planId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setPlanId(plan.id)}
                  className={`rounded-app border px-4 py-4 text-left transition ${
                    active
                      ? "border-indigo/50 bg-indigo/5 shadow-app-card"
                      : "border-app-border bg-app-surface hover:border-indigo/25"
                  }`}
                >
                  <p className="font-semibold text-app-ink">{plan.name}</p>
                  <p className="mt-1 text-2xl font-display tracking-tight text-app-ink">
                    {plan.priceLabel}
                  </p>
                  <p className="mt-1 text-xs text-app-ink-dim">{plan.includedLabel}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
                2 · How big is your business?
              </p>
              <p className="mt-1 text-sm text-app-ink-dim">
                Included usage from the {selectedPlan.name} plan ·{" "}
                <span className="font-medium text-app-ink">
                  {formatEstimatorMoney(estimate.includedUsage)} included
                </span>
              </p>
            </div>
            <p className="font-mono text-sm text-app-ink-mute">Scale {businessScale}/10</p>
          </div>

          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={businessScale}
            onChange={(e) => setBusinessScale(Number(e.target.value))}
            className="mt-4 h-2 w-full cursor-pointer appearance-none rounded-full bg-app-surface-muted accent-indigo"
            aria-label="Business size scale"
          />
          <div className="mt-1 flex justify-between text-[11px] text-app-ink-mute">
            <span>Solo / early</span>
            <span>Scaling team</span>
            <span>Large org</span>
          </div>

          <ul className="mt-6 divide-y divide-app-border rounded-app border border-app-border bg-app-surface">
            <CostLine label="Number of agents" value={String(estimate.agentCount)} />
            <CostLine label="Token cost" value={formatEstimatorMoney(estimate.tokenCost)} />
            <CostLine label="Compute cost" value={formatEstimatorMoney(estimate.computeCost)} />
            <CostLine label="Database cost" value={formatEstimatorMoney(estimate.databaseCost)} />
            <CostLine
              label="Customer support"
              value={formatEstimatorMoney(estimate.customerSupport)}
            />
            <CostLine label="Ad spend" value={formatEstimatorMoney(estimate.adSpend)} />
            <CostLine
              label="Data purchasing"
              value={formatEstimatorMoney(estimate.dataPurchasing)}
            />
            {estimate.overageCost > 0 ? (
              <CostLine
                label="Pipeline overage"
                value={formatEstimatorMoney(estimate.overageCost)}
                hint={`${estimate.pipelineRuns} runs / month`}
              />
            ) : null}
          </ul>

          <div className="mt-4 flex items-center justify-between rounded-app border border-app-border bg-app-lavender/20 px-4 py-4">
            <div>
              <p className="text-sm font-medium text-app-ink">Total monthly cost</p>
              <p className="text-xs text-app-ink-dim">(estimated)</p>
            </div>
            <p className="font-display text-3xl tracking-tight text-app-ink">
              {formatEstimatorMoney(estimate.total)}
            </p>
          </div>
        </section>

        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
            Compare features
          </p>
          <div className="mt-4 overflow-x-auto rounded-app border border-app-border">
            <table className="min-w-[640px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-app-border bg-app-surface-muted/50">
                  <th className="px-4 py-3 font-medium text-app-ink-dim">Pricing plans</th>
                  {ESTIMATOR_PLANS.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 font-semibold text-app-ink">
                      <div>{plan.name}</div>
                      <div className="mt-0.5 text-xs font-normal text-app-ink-dim">
                        {plan.priceLabel}
                        {plan.id === "pilot" ? " · 7 day trial" : " · included usage"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURE_MATRIX.map((section) => (
                  <Fragment key={section.group}>
                    <tr className="bg-app-surface-muted/30">
                      <td
                        colSpan={4}
                        className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-app-ink-mute"
                      >
                        {section.group}
                      </td>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={`${section.group}-${row.label}`} className="border-t border-app-border">
                        <td className="px-4 py-2.5 text-app-ink-dim">{row.label}</td>
                        <FeatureCell value={row.pilot} />
                        <FeatureCell value={row.starter} />
                        <FeatureCell value={row.growth} />
                      </tr>
                    ))}
                  </Fragment>
                ))}
                <tr className="border-t border-app-border bg-app-surface-muted/20">
                  <td className="px-4 py-3" />
                  {ESTIMATOR_PLANS.map((plan) => (
                    <td key={plan.id} className="px-4 py-3">
                      <Link
                        to={
                          isMarketing || plan.id === "pilot"
                            ? "/login"
                            : `${orgPath("settings", "plan")}?plan=${plan.id}`
                        }
                        state={isMarketing || plan.id !== "pilot" ? { mode: "signup" } : undefined}
                        className="inline-flex rounded-full border border-app-border px-3 py-1.5 text-xs font-medium text-app-ink transition hover:border-indigo/40 hover:bg-indigo/5"
                      >
                        {plan.cta}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-center text-xs text-app-ink-mute">
          Need a detailed ROI model?{" "}
          <Link
            to={isMarketing ? "/roi" : orgPath("costs")}
            className="font-medium text-indigo hover:underline"
          >
            {isMarketing ? "Open ROI calculator" : "Open Cost & ROI"}
          </Link>
        </p>
      </div>
    </Panel>
  );
}

function CostLine({ label, value, hint }) {
  return (
    <li className="flex items-center justify-between px-4 py-3 text-sm">
      <span className="text-app-ink-dim">{label}</span>
      <span className="font-medium text-app-ink">
        {value}
        {hint ? <span className="ml-2 text-xs text-app-ink-mute">{hint}</span> : null}
      </span>
    </li>
  );
}

function FeatureCell({ value }) {
  return (
    <td className="px-4 py-2.5 text-center">
      <FeatureValue value={value} />
    </td>
  );
}

function FeatureValue({ value }) {
  if (value === true) {
    return <span className="text-success" aria-label="Included">✓</span>;
  }
  if (value === false) {
    return <span className="text-app-ink-mute" aria-label="Not included">—</span>;
  }
  return <span className="text-xs text-app-ink">{value}</span>;
}
