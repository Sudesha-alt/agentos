import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useCostsSummary, useCostsDaily, useCostsByFeature } from "../../entities/costs";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AppTabButton } from "../../shared/ui/AppChrome";
import RoiCalculatorPanel from "../../widgets/roi-calculator/RoiCalculatorPanel";

export default function CostIntelligence() {
  const [searchParams] = useSearchParams();
  const planParam = searchParams.get("plan") ?? "growth";
  const [tab, setTab] = useState(searchParams.has("plan") ? "estimated" : "actual");
  const [hourlyRate] = useState(150);

  const { data: summary } = useCostsSummary();
  const { data: daily } = useCostsDaily();
  const { data: features } = useCostsByFeature(hourlyRate);

  const hasActualData =
    (summary?.monthSpend ?? 0) > 0 || (features?.features?.length ?? 0) > 0;

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Finance"
        title="Cost per feature and ROI"
      />

      <div className="flex flex-wrap gap-1.5">
        <AppTabButton active={tab === "actual"} onClick={() => setTab("actual")}>
          Actual
        </AppTabButton>
        <AppTabButton active={tab === "estimated"} onClick={() => setTab("estimated")}>
          Estimated
        </AppTabButton>
      </div>

      {tab === "estimated" ? (
        <Panel>
          <PanelHeader
            kicker="ROI"
            title="Annual savings calculator"
          />
          <RoiCalculatorPanel initialPlanId={planParam} />
        </Panel>
      ) : (
        <>
          {!hasActualData ? (
            <Panel className="border-dashed">
              <PanelHeader
                kicker="Actual"
                title="No pipeline cost data yet"
              />
            </Panel>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Spend this month"
              value={`$${summary?.monthSpend?.toFixed(2) ?? "—"}`}
            />
            <MetricCard
              label="Avg per feature"
              value={`$${summary?.avgPerFeature?.toFixed(2) ?? "—"}`}
            />
            <MetricCard
              label="Cost per token"
              value={summary?.costPerToken ? `$${summary.costPerToken}` : "—"}
            />
          </div>

          <Panel>
            <PanelHeader kicker="Breakdown" title="Spend by agent per day" />
            <div className="flex items-end gap-2 px-5 py-5">
              {(daily?.days ?? []).length === 0 ? (
                <p className="text-[13px] text-app-ink-mute">No daily spend recorded yet.</p>
              ) : (
                (daily?.days ?? []).map((day) => {
                  const total = day.product + day.engineering + day.qa;
                  const scale = 120 / Math.max(total, 1);
                  return (
                    <div key={day.day} className="flex flex-1 flex-col items-center gap-2">
                      <div
                        className="flex w-full max-w-[48px] flex-col justify-end gap-0.5"
                        style={{ height: 120 }}
                      >
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
                })
              )}
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
                  {(features?.features ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-app-ink-mute">
                        Complete pipeline runs to see per-feature ROI.
                      </td>
                    </tr>
                  ) : (
                    (features?.features ?? []).map((row) => (
                      <tr key={row.jiraKey} className="border-b border-app-border/60">
                        <td className="px-5 py-2.5 text-indigo">{row.jiraKey}</td>
                        <td className="px-5 py-2.5 text-app-ink-dim">{row.title}</td>
                        <td className="px-5 py-2.5 tabular-nums">{row.tokens.toLocaleString()}</td>
                        <td className="px-5 py-2.5">${row.cost}</td>
                        <td className="px-5 py-2.5">{row.hoursSaved}h</td>
                        <td className="px-5 py-2.5 tabular-nums text-success">{row.roi}x</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
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
