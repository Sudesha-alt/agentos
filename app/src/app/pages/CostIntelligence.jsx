import { useState } from "react";
import {
  useCostsSummary,
  useCostsDaily,
  useCostsByFeature,
  useCostsRoi,
} from "../../entities/costs";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function CostIntelligence() {
  const { data: summary } = useCostsSummary();
  const { data: daily } = useCostsDaily();
  const { data: features } = useCostsByFeature();
  const [hourlyRate, setHourlyRate] = useState(150);
  const [sprintWeeks, setSprintWeeks] = useState(2);
  const [reworkRate, setReworkRate] = useState(0.25);
  const { data: roi } = useCostsRoi({ hourlyRate, sprintWeeks, reworkRate });

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-8">
      <PageIntro
        kicker="Finance"
        title="Cost per feature and ROI"
        body="What leadership needs: spend, trends, and whether automation pays for itself."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Spend this month" value={`$${summary?.monthSpend?.toFixed(2) ?? "—"}`} />
        <MetricCard label="Avg per feature" value={`$${summary?.avgPerFeature?.toFixed(2) ?? "—"}`} />
        <MetricCard
          label="Cost per token"
          value={summary?.costPerToken ? `$${summary.costPerToken}` : "—"}
        />
      </div>

      <Panel>
        <PanelHeader kicker="Breakdown" title="Spend by agent per day" />
        <div className="flex items-end gap-2 px-5 py-6">
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
                <span className="font-mono text-[10px] text-ink-mute">{day.day}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 border-t border-hairline px-5 py-3 font-mono text-[10px] text-ink-mute">
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
            <thead className="border-b border-hairline font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              <tr>
                <th className="px-5 py-3">Ticket</th>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Tokens</th>
                <th className="px-5 py-3">Cost</th>
                <th className="px-5 py-3">Hours saved</th>
                <th className="px-5 py-3">ROI</th>
              </tr>
            </thead>
            <tbody>
              {(features?.features ?? []).map((row) => (
                <tr key={row.jiraKey} className="border-b border-hairline/60">
                  <td className="px-5 py-3 font-mono text-indigo">{row.jiraKey}</td>
                  <td className="px-5 py-3 text-ink-dim">{row.title}</td>
                  <td className="px-5 py-3 font-mono">{row.tokens.toLocaleString()}</td>
                  <td className="px-5 py-3">${row.cost}</td>
                  <td className="px-5 py-3">{row.hoursSaved}h</td>
                  <td className="px-5 py-3 font-mono text-success">{row.roi}x</td>
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
          body="Uses your inputs plus real pipeline throughput assumptions."
        />
        <div className="grid gap-6 px-5 py-6 sm:grid-cols-3">
          <label className="block">
            <span className="font-mono text-[10px] uppercase text-ink-mute">Hourly rate ($)</span>
            <input
              type="number"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-hairline bg-canvas/50 px-3"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase text-ink-mute">Sprint length (weeks)</span>
            <input
              type="number"
              value={sprintWeeks}
              onChange={(e) => setSprintWeeks(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-hairline bg-canvas/50 px-3"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] uppercase text-ink-mute">Rework rate (0–1)</span>
            <input
              type="number"
              step="0.05"
              max="1"
              min="0"
              value={reworkRate}
              onChange={(e) => setReworkRate(Number(e.target.value))}
              className="mt-2 h-10 w-full rounded-lg border border-hairline bg-canvas/50 px-3"
            />
          </label>
        </div>
        {roi ? (
          <div className="border-t border-hairline px-5 py-6">
            <p className="font-display text-4xl text-success">
              ${roi.annualSavings.toLocaleString()}
              <span className="text-lg text-ink-dim"> projected annual savings</span>
            </p>
            <p className="mt-2 text-[13px] text-ink-dim">
              Net after subscription estimate: ${roi.netBenefit.toLocaleString()}
            </p>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="rounded-[1.25rem] border border-hairline bg-surface/35 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink">{value}</p>
    </div>
  );
}
