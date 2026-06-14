import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCostsSummary,
  useCostsDaily,
  useCostsByFeature,
  useCostsRoi,
} from "../../entities/costs";
import { BILLING_PLANS } from "../../shared/config/billingPlans";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

const PLAN_SUBSCRIPTION = {
  starter: 1999,
  growth: 4999,
  enterprise: 40000 / 12,
};

export default function CostIntelligence() {
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan") ?? "growth";
  const plan = BILLING_PLANS.find((p) => p.id === planParam) ?? BILLING_PLANS[1];
  const defaultSubscription = PLAN_SUBSCRIPTION[plan.id] ?? 4999;

  const { data: summary } = useCostsSummary();
  const { data: daily } = useCostsDaily();
  const { data: features } = useCostsByFeature();
  const [hourlyRate, setHourlyRate] = useState(150);
  const [sprintWeeks, setSprintWeeks] = useState(2);
  const [reworkRate, setReworkRate] = useState(0.25);
  const { data: roi } = useCostsRoi({
    hourlyRate,
    sprintWeeks,
    reworkRate,
    subscriptionCost: defaultSubscription,
  });

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Finance"
        title="Cost per feature and ROI"
        body="What leadership needs: spend, trends, and whether automation pays for itself."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Spend this month" value={`$${summary?.monthSpend?.toFixed(2) ?? "—"}`} />
        <MetricCard label="Avg per feature" value={`$${summary?.avgPerFeature?.toFixed(2) ?? "—"}`} />
        <MetricCard
          label="Cost per token"
          value={summary?.costPerToken ? `$${summary.costPerToken}` : "—"}
        />
      </div>

      <Panel>
        <PanelHeader kicker="Breakdown" title="Spend by agent per day" />
        <div className="flex items-end gap-2 px-5 py-5">
          {(daily?.days ?? []).map((day) => {
            const total = day.product + day.engineering + day.qa;
            const scale = 120 / Math.max(total, 1);
            return (
              <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full max-w-[48px] flex-col justify-end gap-0.5" style={{ height: 120 }}>
                  <div
                    className="w-full bg-indigo/80"
                    style={{ height: day.qa * scale }}
                    title={`QA $${day.qa}`}
                  />
                  <div
                    className="w-full bg-indigo/50"
                    style={{ height: day.engineering * scale }}
                    title={`Eng $${day.engineering}`}
                  />
                  <div
                    className="w-full bg-indigo/30"
                    style={{ height: day.product * scale }}
                    title={`Product $${day.product}`}
                  />
                </div>
                <span className="type-kicker">{day.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 border-t border-app-border px-5 py-3 type-kicker">
          <span className="flex items-center gap-1">
            <span className="size-2 rounded bg-indigo/30" /> Product
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded bg-indigo/50" /> Engineering
          </span>
          <span className="flex items-center gap-1">
            <span className="size-2 rounded bg-indigo/80" /> QA
          </span>
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="Features" title="Per-feature economics" />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-app-border type-kicker">
              <tr>
                <th className="px-5 py-2.5">Ticket</th>
                <th className="px-5 py-2.5">Title</th>
                <th className="px-5 py-2.5">Tokens</th>
                <th className="px-5 py-2.5">Cost</th>
                <th className="px-5 py-2.5">Hours saved</th>
                <th className="px-5 py-2.5">ROI</th>
              </tr>
            </thead>
            <tbody>
              {(features?.features ?? []).map((row) => (
                <tr key={row.jiraKey} className="border-b border-app-border/60">
                  <td className="px-5 py-2.5 text-indigo">{row.jiraKey}</td>
                  <td className="px-5 py-2.5 text-app-ink-dim">{row.title}</td>
                  <td className="px-5 py-2.5 tabular-nums">{row.tokens.toLocaleString()}</td>
                  <td className="px-5 py-2.5">${row.cost}</td>
                  <td className="px-5 py-2.5">{row.hoursSaved}h</td>
                  <td className="px-5 py-2.5 tabular-nums text-success">{row.roi}x</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="ROI"
          title="Annual savings calculator"
          body={`Pre-filled for ${plan.name} (${plan.priceLabel}${plan.period ? `/${plan.period}` : ""}). Adjust inputs to model your team.`}
        />
        <div className="grid gap-5 px-5 py-5 sm:grid-cols-3">
          <label className="block">
            <span className="type-kicker">Hourly rate ($)</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="mt-1.5 h-9 w-full rounded-app-sm border border-app-border bg-app-surface px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="type-kicker">Sprint length (weeks)</span>
            <input
              type="number"
              value={sprintWeeks}
              onChange={(e) => setSprintWeeks(Number(e.target.value))}
              className="mt-1.5 h-9 w-full rounded-app-sm border border-app-border bg-app-surface px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="type-kicker">Rework rate (0–1)</span>
            <input
              type="number"
              step="0.05"
              max="1"
              min="0"
              value={reworkRate}
              onChange={(e) => setReworkRate(Number(e.target.value))}
              className="mt-1.5 h-9 w-full rounded-app-sm border border-app-border bg-app-surface px-3 text-sm"
            />
          </label>
        </div>
        {roi ? (
          <div className="border-t border-app-border px-5 py-5">
            <p className="type-metric text-success">
              ${roi.annualSavings.toLocaleString()}
              <span className="ml-2 text-base font-normal text-app-ink-dim">
                projected annual savings
              </span>
            </p>
            <p className="mt-1.5 text-[13px] text-app-ink-dim">
              Net after subscription estimate: ${roi.netBenefit.toLocaleString()}
            </p>
          </div>
        ) : null}
      </Panel>
    </AnimatedAppPage>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-app border border-app-border bg-app-surface px-4 py-3.5">
      <p className="type-kicker">{label}</p>
      <p className="type-metric mt-1.5">{value}</p>
    </div>
  );
}
