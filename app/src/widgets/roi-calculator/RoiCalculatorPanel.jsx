import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BILLING_PLANS, DEFAULT_RUNS_PER_MONTH, PILOT_PLAN } from "../../shared/config/billingPlans";
import { DEFAULT_ROI_ASSUMPTIONS } from "../../shared/roi/assumptions";
import { computeEstimatedRoi } from "../../shared/roi/estimatedRoi";

const PLAN_OPTIONS = [
  { id: "pilot", name: PILOT_PLAN.name },
  ...BILLING_PLANS.map((p) => ({ id: p.id, name: p.name })),
];

function formatMoney(value) {
  return `$${Math.round(value).toLocaleString()}`;
}

export function RoiCalculatorPanel({
  initialPlanId = "growth",
  showPlanSelector = true,
  publicMode = false,
  className = "",
}) {
  const [planId, setPlanId] = useState(initialPlanId);
  const [teamSize, setTeamSize] = useState(10);
  const [hourlyRate, setHourlyRate] = useState(150);
  const [pipelineRunsPerMonth, setPipelineRunsPerMonth] = useState(
    DEFAULT_RUNS_PER_MONTH[initialPlanId] ?? 80
  );
  const [sprintWeeks, setSprintWeeks] = useState(DEFAULT_ROI_ASSUMPTIONS.defaultSprintWeeks);
  const [reworkRate, setReworkRate] = useState(0.25);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);

  const planMeta = BILLING_PLANS.find((p) => p.id === planId);

  const roi = useMemo(
    () =>
      computeEstimatedRoi({
        planId,
        teamSize,
        hourlyRate,
        pipelineRunsPerMonth,
        sprintWeeks,
        reworkRate,
      }),
    [planId, teamSize, hourlyRate, pipelineRunsPerMonth, sprintWeeks, reworkRate]
  );

  function handlePlanChange(nextPlanId) {
    setPlanId(nextPlanId);
    setPipelineRunsPerMonth(DEFAULT_RUNS_PER_MONTH[nextPlanId] ?? 80);
  }

  const subtitle = planMeta
    ? `${planMeta.name} (${planMeta.priceLabel}${planMeta.period ? `/${planMeta.period}` : ""})`
    : PILOT_PLAN.name;

  return (
    <div className={className}>
      {showPlanSelector ? (
        <div className="flex flex-wrap gap-2 px-5 pt-5 sm:px-6">
          {PLAN_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handlePlanChange(option.id)}
              className={`rounded-full px-3.5 py-1.5 text-[12px] font-medium transition ${
                planId === option.id
                  ? "bg-indigo/12 text-app-ink"
                  : "border border-app-border text-app-ink-dim hover:border-indigo/30"
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>
      ) : null}

      <p className="px-5 pt-4 text-[13px] text-app-ink-dim sm:px-6">
        Model savings for <span className="font-medium text-app-ink">{subtitle}</span>. Adjust
        inputs to match your team.
      </p>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
        <NumberField label="Team size" value={teamSize} onChange={setTeamSize} min={1} />
        <NumberField label="Hourly rate ($)" value={hourlyRate} onChange={setHourlyRate} min={1} />
        <NumberField
          label="Pipeline runs / month"
          value={pipelineRunsPerMonth}
          onChange={setPipelineRunsPerMonth}
          min={1}
        />
        <NumberField
          label="Sprint length (weeks)"
          value={sprintWeeks}
          onChange={setSprintWeeks}
          min={0.5}
          step={0.5}
        />
        <NumberField
          label="Rework rate (0–1)"
          value={reworkRate}
          onChange={setReworkRate}
          min={0}
          max={1}
          step={0.05}
        />
        <div className="flex flex-col justify-end rounded-app border border-app-border bg-app-surface-muted/30 p-4">
          <p className="type-kicker">Hours saved / run</p>
          <p className="type-metric mt-1">{roi.hoursSavedPerRun}h</p>
        </div>
      </div>

      <div className="grid gap-4 border-t border-app-border px-5 py-5 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
        <ResultCard
          label="Projected annual savings"
          value={formatMoney(roi.annualLaborSavings)}
          tone="success"
        />
        <ResultCard
          label="Net annual benefit"
          value={formatMoney(roi.netAnnualBenefit)}
          tone={roi.netAnnualBenefit >= 0 ? "success" : "danger"}
        />
        <ResultCard label="ROI multiple" value={`${roi.roiMultiple}x`} />
        <ResultCard
          label="Payback period"
          value={roi.paybackMonths != null ? `${roi.paybackMonths} mo` : "—"}
        />
      </div>

      <div className="border-t border-app-border px-5 pb-5 sm:px-6">
        <button
          type="button"
          onClick={() => setAssumptionsOpen((v) => !v)}
          className="flex w-full items-center justify-between py-4 text-left text-[13px] font-medium text-app-ink-dim hover:text-app-ink"
        >
          Model assumptions (v{DEFAULT_ROI_ASSUMPTIONS.version})
          <span className="text-app-ink-mute">{assumptionsOpen ? "−" : "+"}</span>
        </button>
        {assumptionsOpen ? (
          <ul className="space-y-1.5 pb-2 text-[12px] leading-relaxed text-app-ink-dim">
            <li>
              Baseline hours per pipeline run: {DEFAULT_ROI_ASSUMPTIONS.baselineHoursPerRun}h
            </li>
            <li>
              Stage savings — Product {(DEFAULT_ROI_ASSUMPTIONS.productSavingsPct * 100).toFixed(0)}
              %, Engineering {(DEFAULT_ROI_ASSUMPTIONS.engineeringSavingsPct * 100).toFixed(0)}%,
              QA {(DEFAULT_ROI_ASSUMPTIONS.qaSavingsPct * 100).toFixed(0)}%
            </li>
            <li>Rework multiplier: {DEFAULT_ROI_ASSUMPTIONS.reworkMultiplier}</li>
            <li>
              Subscription: {formatMoney(roi.assumptions.monthlyPrice)}/mo
              {roi.assumptions.planRunsCap != null
                ? ` · cap ${roi.assumptions.planRunsCap} runs`
                : " · unlimited runs"}
            </li>
            {roi.annualOverage > 0 ? (
              <li>Estimated annual overage: {formatMoney(roi.annualOverage)}</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {publicMode ? (
        <div className="flex flex-wrap gap-3 border-t border-app-border px-5 py-5 sm:px-6">
          <Link to="/login" className="app-btn-primary">
            Start pilot
          </Link>
          <Link
            to="/contact"
            className="rounded-full border border-app-border px-5 py-2.5 text-sm font-medium text-app-ink-dim transition hover:border-indigo/30 hover:text-app-ink"
          >
            Contact sales
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block">
      <span className="type-kicker">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-9 w-full rounded-app-sm border border-app-border bg-app-surface px-3 text-sm"
      />
    </label>
  );
}

function ResultCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-app-ink";
  return (
    <div className="rounded-app border border-app-border bg-app-surface px-4 py-3.5">
      <p className="type-kicker">{label}</p>
      <p className={`type-metric mt-1.5 ${toneClass}`}>{value}</p>
    </div>
  );
}

export default RoiCalculatorPanel;
