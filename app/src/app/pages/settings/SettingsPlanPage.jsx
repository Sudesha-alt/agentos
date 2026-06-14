import { Link } from "react-router-dom";
import { useWorkspaceBilling } from "../../../entities/billing";
import { Panel, PanelHeader } from "../../../shared/ui/Panel";
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  PILOT_PLAN,
  PIPELINE_RUN_DEFINITION,
  PLAN_COMPARISON_ROWS,
  planRoiCalculatorHref,
} from "../../../shared/config/billingPlans";

export default function SettingsPlanPage() {
  const { data: billing } = useWorkspaceBilling();

  const currentPlanId = billing?.planId ?? "pilot";
  const isPilot = currentPlanId === "pilot";

  return (
    <div className="space-y-6">
      {isPilot ? (
        <Panel className="border-indigo/25 bg-indigo/5">
          <PanelHeader
            kicker="Current plan"
            title={`${PILOT_PLAN.name} program`}
            body={`${PILOT_PLAN.description} Cap: ${PILOT_PLAN.pipelineRunsCap} runs · ${PILOT_PLAN.durationDays}-day window.`}
            right={
              <span className="w-full shrink-0 self-start rounded-full border border-indigo/30 bg-indigo/10 px-3 py-1 text-center text-[11px] font-medium text-indigo sm:w-auto sm:text-[12px]">
                {billing?.runsUsed ?? 0} / {PILOT_PLAN.pipelineRunsCap} runs used
              </span>
            }
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader
            kicker="Current plan"
            title={BILLING_PLANS.find((p) => p.id === currentPlanId)?.name ?? "Growth"}
            body="Manage your subscription through your account team. Usage resets monthly."
          />
        </Panel>
      )}

      <Panel>
        <PanelHeader
          kicker="Usage unit"
          title="What counts as a pipeline run?"
          body={PIPELINE_RUN_DEFINITION}
        />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {BILLING_PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} current={currentPlanId === plan.id} />
        ))}
      </div>

      <Panel>
        <PanelHeader kicker="Compare" title="Feature comparison" />
        <div className="overflow-x-auto px-2 pb-4">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-app-border type-kicker">
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Starter</th>
                <th className="px-4 py-3">Growth</th>
                <th className="px-4 py-3">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className="border-b border-app-border/60">
                  <td className="px-4 py-2.5 font-medium text-app-ink">{row.feature}</td>
                  <td className="px-4 py-2.5 text-app-ink-dim">{formatCell(row.starter)}</td>
                  <td className="px-4 py-2.5 text-app-ink-dim">{formatCell(row.growth)}</td>
                  <td className="px-4 py-2.5 text-app-ink-dim">{formatCell(row.enterprise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Add-ons"
          title="Available on any tier"
          body="Annual billing saves 15% when billed yearly."
        />
        <ul className="space-y-2 px-5 py-4 sm:px-6">
          {BILLING_ADDONS.map((addon) => (
            <li
              key={addon.name}
              className="flex flex-wrap items-center justify-between gap-2 rounded-app-sm border border-app-border px-4 py-3 text-[13px]"
            >
              <span className="text-app-ink">{addon.name}</span>
              <span className="font-medium text-app-ink-dim">{addon.price}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <p className="text-center text-[12px] text-app-ink-mute">
        Questions about Enterprise or Pilot conversion?{" "}
        <Link to="/contact" className="text-indigo hover:underline">
          Contact sales
        </Link>
      </p>
    </div>
  );
}

function PlanCard({ plan, current }) {
  return (
    <div
      className={`flex flex-col rounded-app border p-5 ${
        plan.popular
          ? "border-indigo/40 bg-indigo/5 shadow-sm"
          : "border-app-border bg-app-surface"
      } ${current ? "ring-2 ring-indigo/30" : ""}`}
    >
      {plan.popular ? (
        <span className="mb-2 w-fit rounded-full bg-indigo/15 px-2.5 py-0.5 text-[11px] font-medium text-indigo">
          Most popular
        </span>
      ) : null}
      {current ? (
        <span className="mb-2 w-fit rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-[11px] text-success">
          Current plan
        </span>
      ) : null}
      <h3 className="font-display text-xl text-app-ink">{plan.name}</h3>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-app-ink">
        {plan.priceLabel}
        {plan.period ? (
          <span className="text-[14px] font-normal text-app-ink-mute">/{plan.period}</span>
        ) : null}
      </p>
      {plan.priceSub ? (
        <p className="text-[12px] text-app-ink-mute">{plan.priceSub}</p>
      ) : null}
      <p className="mt-3 text-[13px] leading-relaxed text-app-ink-dim">{plan.tagline}</p>
      <ul className="mt-4 flex-1 space-y-1.5 text-[12px] leading-relaxed text-app-ink-dim">
        {plan.included.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-indigo">·</span>
            {item}
          </li>
        ))}
      </ul>
      {plan.overage ? (
        <p className="mt-3 text-[11px] text-app-ink-mute">
          <span className="font-medium">Overage:</span> {plan.overage}
        </p>
      ) : null}
      <p className="mt-2 text-[11px] text-app-ink-mute">
        <span className="font-medium">Best for:</span> {plan.bestFor}
      </p>
      <Link
        to={planRoiCalculatorHref(plan.id)}
        className="mt-4 block rounded-full border border-app-border py-2 text-center text-[12px] font-medium text-indigo transition hover:border-indigo/40 hover:bg-indigo/5"
      >
        See estimated ROI →
      </Link>
    </div>
  );
}

function formatCell(value) {
  if (value === true) return "✓";
  if (value === false) return "—";
  return String(value);
}
