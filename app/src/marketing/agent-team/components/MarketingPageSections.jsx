import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  DIFFERENTIATION,
  FAQ,
  FINAL_CTA,
  HOW_IT_WORKS,
  INTELLIGENCE,
  PRICING,
  PROBLEM,
  ROI_ASSUMPTIONS,
  SOCIAL_PROOF,
  SOLUTION,
} from "../marketingPageContent";

function SectionHeader({ kicker, headline, subhead, center = true }) {
  return (
    <div className={`mb-10 ${center ? "text-center" : ""}`}>
      {kicker ? (
        <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">{kicker}</p>
      ) : null}
      <h2
        className={`mt-2 whitespace-pre-line text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33] ${
          center ? "mx-auto max-w-3xl" : "max-w-3xl"
        }`}
      >
        {headline}
      </h2>
      {subhead ? (
        <p className={`mt-3 text-[15px] leading-relaxed text-[#6B6B6B] ${center ? "mx-auto max-w-2xl" : "max-w-2xl"}`}>
          {subhead}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingProblemSection() {
  return (
    <section id="problem" className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeader kicker={PROBLEM.kicker} headline={PROBLEM.headline} />
        <div className="grid gap-5 md:grid-cols-3">
          {PROBLEM.cards.map((card) => (
            <article key={card.title} className="at-card p-6">
              <h3 className="text-lg font-semibold leading-snug text-[#2B2D33]">{card.title}</h3>
              <div className="mt-4 space-y-3 text-[14px] leading-relaxed text-[#6B6B6B]">
                {card.body.map((p) => (
                  <p key={p.slice(0, 40)}>{p}</p>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingSolutionSection() {
  return (
    <section id="solution" className="border-t border-[#E8E4DE] bg-[#FAF7F0]/60 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeader
          kicker={SOLUTION.kicker}
          headline={SOLUTION.headline}
          subhead={SOLUTION.subhead}
        />
        <div className="at-card overflow-hidden font-mono text-[11px] sm:text-[12px]">
          {SOLUTION.pipelineSteps.map((step, i) => (
            <div
              key={step.label}
              className={`border-b border-[#E8E4DE] px-5 py-3 last:border-b-0 ${
                step.label.includes("GATE") ? "bg-[#FAF7F0]" : "bg-white"
              }`}
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-semibold tracking-wide text-[#2B2D33]">{step.label}</span>
                {step.detail ? (
                  <span className="text-[#6B6B6B]">{step.detail}</span>
                ) : null}
              </div>
              {i < SOLUTION.pipelineSteps.length - 1 ? (
                <p className="mt-2 text-center text-[#A8C53A]">↓</p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingDifferentiationSection() {
  return (
    <section id="differentiation" className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeader kicker={DIFFERENTIATION.kicker} headline={DIFFERENTIATION.headline} />
        <div className="at-card overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-[#E8E4DE] bg-[#FAF7F0]">
                {DIFFERENTIATION.columns.map((col) => (
                  <th
                    key={col || "feature"}
                    className="px-4 py-3 text-left font-semibold text-[#2B2D33] first:w-[28%]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DIFFERENTIATION.rows.map((row) => (
                <tr key={row.feature} className="border-b border-[#E8E4DE]">
                  <td className="px-4 py-2.5 font-medium text-[#2B2D33]">{row.feature}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-center text-[#6B6B6B]">
                      {v ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
              ))}
              {DIFFERENTIATION.footerRows.map((row) => (
                <tr key={row.label} className="border-b border-[#E8E4DE] bg-[#FAF7F0]/50">
                  <td className="px-4 py-2.5 font-medium text-[#2B2D33]">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="px-4 py-2.5 text-[#6B6B6B]">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 space-y-3 text-[15px] leading-relaxed text-[#6B6B6B]">
          {DIFFERENTIATION.supporting.map((p) => (
            <p key={p.slice(0, 50)}>{p}</p>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingIntelligenceSection() {
  return (
    <section id="intelligence" className="border-t border-[#E8E4DE] bg-[#FAF7F0]/60 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeader
          kicker={INTELLIGENCE.kicker}
          headline={INTELLIGENCE.headline}
          subhead={INTELLIGENCE.body}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          {INTELLIGENCE.callouts.map((item) => (
            <article key={item.title} className="at-card p-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                {item.title}
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-[#2B2D33]">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingHowItWorksSection() {
  return (
    <section id="how-it-works" className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <SectionHeader kicker={HOW_IT_WORKS.kicker} headline={HOW_IT_WORKS.headline} />
        <ol className="space-y-5">
          {HOW_IT_WORKS.steps.map((step, i) => (
            <li key={step.title} className="at-card flex gap-4 p-5 sm:p-6">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#A8C53A]/25 text-sm font-bold text-[#2B2D33]">
                {i + 1}
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#2B2D33]">
                  Step {i + 1} — {step.title}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[#6B6B6B]">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function MarketingFaqSection() {
  return (
    <section id="faq" className="border-t border-[#E8E4DE] px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeader kicker={FAQ.kicker} headline={FAQ.headline} />
        <div className="space-y-4">
          {FAQ.items.map((item) => (
            <details key={item.q} className="at-card group px-5 py-4">
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-[#2B2D33] marker:content-none [&::-webkit-details-marker]:hidden">
                {item.q}
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-[#6B6B6B]">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingPricingTableSection() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-3">
      {PRICING.tiers.map((tier) => (
        <div
          key={tier.name}
          className={`at-card flex flex-col p-6 ${tier.badge ? "ring-2 ring-[#A8C53A]/40" : ""}`}
        >
          {tier.badge ? (
            <span className="mb-2 inline-flex w-fit rounded-full bg-[#A8C53A]/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2B2D33]">
              {tier.badge}
            </span>
          ) : null}
          <h3 className="text-lg font-bold text-[#2B2D33]">{tier.name}</h3>
          <p className="mt-1 text-2xl font-semibold text-[#2B2D33]">{tier.price}</p>
          <ul className="mt-5 flex-1 space-y-2 text-[13px] text-[#6B6B6B]">
            {tier.features.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="text-[#A8C53A]">→</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            to="/login"
            state={{ mode: "signup" }}
            className="at-btn-charcoal mt-6 inline-flex justify-center px-5 py-2.5 text-[13px] font-semibold"
          >
            {tier.cta}
          </Link>
        </div>
      ))}
    </div>
  );
}

export function MarketingSocialProofSection({ clientLogos, clientMetrics }) {
  return (
    <section id="clients" data-clients className="px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <SectionHeader kicker="Social proof" headline={SOCIAL_PROOF.headline} />
        <p className="mx-auto -mt-6 mb-10 max-w-2xl text-center text-[14px] italic text-[#6B6B6B]">
          {SOCIAL_PROOF.placeholder}
        </p>
        <div className="at-marquee overflow-hidden">
          <div className="at-marquee-track flex w-max gap-12">
            {[...clientLogos, ...clientLogos].map((name, i) => (
              <span
                key={`${name}-${i}`}
                className="shrink-0 text-lg font-semibold text-[#6B6B6B]/40 transition hover:text-[#2B2D33]"
              >
                {name}
              </span>
            ))}
          </div>
        </div>
        <ul className="mx-auto mt-8 max-w-2xl space-y-2 text-center text-[13px] text-[#6B6B6B]">
          {SOCIAL_PROOF.metrics.map((m) => (
            <li key={m}>· {m}</li>
          ))}
        </ul>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {clientMetrics.map((m) => (
            <div key={m.label} data-client-metric className="at-card p-6 text-center">
              <p className="at-metric text-[#2B2D33]">{m.value}</p>
              <p className="mt-1 text-[14px] text-[#6B6B6B]">{m.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function MarketingFinalCtaSection() {
  return (
    <section className="px-5 py-24 sm:px-8" data-final-cta>
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold text-[#2B2D33]">
          {FINAL_CTA.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-relaxed text-[#6B6B6B]">
          {FINAL_CTA.subhead}
        </p>
        <Link
          to="/login"
          state={{ mode: "signup" }}
          className="at-btn-charcoal mt-8 inline-flex px-8 py-4 text-[15px] font-semibold"
        >
          {FINAL_CTA.cta}
        </Link>
        <p className="mt-4 text-[13px] text-[#6B6B6B]">{FINAL_CTA.footnote}</p>
        <p className="mt-6 text-[14px] text-[#2B2D33]">
          {FINAL_CTA.contact}{" "}
          <a href={`mailto:${FINAL_CTA.email}`} className="font-medium text-indigo hover:underline">
            {FINAL_CTA.email}
          </a>
        </p>
        <p className="mt-1 text-[12px] text-[#6B6B6B]">{FINAL_CTA.emailNote}</p>
      </div>
    </section>
  );
}

const REWORK_DURATION_OPTIONS = [
  { label: "Less than 1 day", value: 0.5 },
  { label: "1–2 days", value: 1.5 },
  { label: "3–5 days", value: 4 },
  { label: "More than 5 days", value: 7 },
];

function formatMoney(n) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.round(n));
}

export function MarketingRoiCalculator() {
  const [engineers, setEngineers] = useState(20);
  const [monthlyCost, setMonthlyCost] = useState(10000);
  const [featuresPerMonth, setFeaturesPerMonth] = useState(20);
  const [reworkRatePct, setReworkRatePct] = useState(30);
  const [reworkDays, setReworkDays] = useState(1.5);
  const [email, setEmail] = useState("");
  const [reportSent, setReportSent] = useState(false);

  const results = useMemo(() => {
    const reworkRate = reworkRatePct / 100;
    const dailyCost = monthlyCost / ROI_ASSUMPTIONS.workingDaysPerMonth;
    const reworkEvents = featuresPerMonth * reworkRate;
    const costPerEvent =
      dailyCost * reworkDays * ROI_ASSUMPTIONS.engineersPerRework;
    const monthlyReworkCost = reworkEvents * costPerEvent;
    const annualReworkCost = monthlyReworkCost * 12;
    const monthlySavings = monthlyReworkCost * ROI_ASSUMPTIONS.reworkReductionRate;
    const annualSavings = monthlySavings * 12;
    const agentoxAnnual = ROI_ASSUMPTIONS.agentoxGrowthCost * 12;
    const roiPct = agentoxAnnual > 0 ? Math.round((annualSavings / agentoxAnnual) * 100) : 0;
    const paybackMonths =
      monthlySavings > 0 ? ROI_ASSUMPTIONS.agentoxGrowthCost / monthlySavings : null;
    const annualNet = annualSavings - agentoxAnnual;

    let recommend = "GROWTH — $4,999/month";
    let recommendReason =
      "Your feature volume suggests you'll need more than 40 pipeline runs per month. Growth tier gives you 150 runs plus codebase intelligence.";
    if (engineers <= 30 && featuresPerMonth <= 40) {
      recommend = "STARTER — $1,999/month";
      recommendReason =
        "Your team size and feature volume fit comfortably within the Starter tier's 40 pipeline runs per month.";
    }
    if (engineers > 150) {
      recommend = "ENTERPRISE — Custom pricing";
      recommendReason =
        "At your team size we recommend a custom plan. Talk to us about multi-repo intelligence and compliance reporting.";
    }

    return {
      reworkEvents: Math.round(reworkEvents * 10) / 10,
      monthlyReworkCost,
      annualReworkCost,
      annualSavings,
      roiPct,
      paybackMonths,
      annualNet,
      recommend,
      recommendReason,
    };
  }, [engineers, monthlyCost, featuresPerMonth, reworkRatePct, reworkDays]);

  function handleShareLinkedIn() {
    const text = `My team spends ${formatMoney(results.monthlyReworkCost)}/month on sprint rework. AgentOX saves ${formatMoney(results.annualSavings / 12)}/month of it. Here's the math:`;
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <section id="roi" className="border-t border-[#E8E4DE] bg-[#FAF7F0]/60 px-5 py-20 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <SectionHeader
          kicker="ROI calculator"
          headline="Calculate your engineering rework cost."
          subhead="See what AgentOX saves you. Every number updates in real time as you adjust the inputs."
        />
        <div className="at-card grid gap-8 p-6 lg:grid-cols-2 lg:p-8">
          <div className="space-y-6">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
              Your inputs
            </p>
            <RoiSlider
              label="Engineers on your team"
              value={engineers}
              min={5}
              max={200}
              step={5}
              display={`${engineers} engineers`}
              onChange={setEngineers}
            />
            <RoiSlider
              label="Average monthly engineer cost (fully loaded)"
              value={monthlyCost}
              min={5000}
              max={25000}
              step={1000}
              display={`${formatMoney(monthlyCost)}/month`}
              helper="Include salary, benefits, taxes, and overhead. Typical range: $8,000–15,000 for US teams."
              onChange={setMonthlyCost}
            />
            <RoiSlider
              label="Features your team ships per month"
              value={featuresPerMonth}
              min={5}
              max={100}
              step={5}
              display={`${featuresPerMonth} features/month`}
              onChange={setFeaturesPerMonth}
            />
            <RoiSlider
              label="What % of features require meaningful rework?"
              value={reworkRatePct}
              min={5}
              max={60}
              step={5}
              display={`${reworkRatePct}% of features`}
              helper="Industry average is 30–40%. Be honest — the calculator only works if you are."
              onChange={setReworkRatePct}
            />
            <label className="block">
              <span className="text-[13px] font-medium text-[#2B2D33]">
                When rework happens, how long does it take?
              </span>
              <select
                value={reworkDays}
                onChange={(e) => setReworkDays(Number(e.target.value))}
                className="mt-2 w-full rounded-lg border border-[#E8E4DE] bg-white px-3 py-2.5 text-[14px] text-[#2B2D33]"
              >
                {REWORK_DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-4">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
              Your results
            </p>
            <RoiOutput
              label="Your team spends this on rework every month"
              value={formatMoney(results.monthlyReworkCost)}
              sub={`That is ${results.reworkEvents} features rebuilt from scratch each month`}
              tone="danger"
            />
            <RoiOutput
              label="Annual cost of requirements misinterpretation"
              value={formatMoney(results.annualReworkCost)}
              sub="Before accounting for delayed revenue and team frustration"
              tone="danger"
            />
            <RoiOutput
              label="What AgentOX saves you annually"
              value={formatMoney(results.annualSavings)}
              sub="Based on 60% reduction in rework events — conservative estimate from early customer data"
              tone="success"
            />
            <RoiOutput
              label="Return on AgentOX investment"
              value={`${results.roiPct}%`}
              sub={
                results.paybackMonths != null
                  ? `Payback period: ${results.paybackMonths.toFixed(1)} months`
                  : ""
              }
              tone="success"
              large
            />
            <p className="text-[13px] leading-relaxed text-[#6B6B6B]">
              At your team size and rework rate, AgentOX pays for itself in{" "}
              {results.paybackMonths != null ? results.paybackMonths.toFixed(1) : "—"} months and
              delivers {formatMoney(results.annualNet)} in net savings annually — before accounting
              for faster shipping and avoided hiring.
            </p>
          </div>
        </div>

        <div className="at-card mt-8 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Recommended plan for your team
          </p>
          <p className="mt-2 text-xl font-bold text-[#2B2D33]">{results.recommend}</p>
          <p className="mt-2 text-[14px] text-[#6B6B6B]">{results.recommendReason}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/login"
              state={{ mode: "signup" }}
              className="at-btn-charcoal inline-flex px-5 py-2.5 text-[13px] font-semibold"
            >
              Get started with this plan →
            </Link>
            <Link to="/contact" className="inline-flex px-5 py-2.5 text-[13px] font-medium text-indigo hover:underline">
              Talk to us first
            </Link>
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-[#6B6B6B]">
          How we calculated this: Rework cost = (features/month × rework rate) × (rework days × 2
          engineers × daily cost). Savings = rework cost × 60% reduction rate. ROI = annual savings
          / annual AgentOX cost. Assumptions: 22 working days per month, 2 engineers involved per
          rework event, 60% rework reduction (conservative based on validation gate effectiveness).
          Actual results vary by team, codebase complexity, and ticket quality.
        </p>

        <div className="at-card mt-8 p-6">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
            Your personalised ROI report
          </p>
          <p className="mt-2 text-[14px] text-[#6B6B6B]">
            We'll send you a detailed breakdown of your numbers plus a comparison of your current
            cost versus AgentOX over a 12-month period.
          </p>
          {!reportSent ? (
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) setReportSent(true);
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Work email address"
                className="flex-1 rounded-lg border border-[#E8E4DE] px-4 py-2.5 text-[14px]"
              />
              <button type="submit" className="at-btn-charcoal px-5 py-2.5 text-[13px] font-semibold">
                Send my report →
              </button>
            </form>
          ) : (
            <p className="mt-4 text-[14px] text-success">Thanks — we'll send your report shortly.</p>
          )}
          <p className="mt-3 text-[11px] text-[#6B6B6B]">
            We send one email. No sequences. No spam. Your numbers stay private.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-[13px]">
          <span className="text-[#6B6B6B]">Share your numbers:</span>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(window.location.href)}
            className="rounded-full border border-[#E8E4DE] px-4 py-1.5 hover:border-[#2B2D33]/20"
          >
            Copy results link
          </button>
          <button
            type="button"
            onClick={handleShareLinkedIn}
            className="rounded-full border border-[#E8E4DE] px-4 py-1.5 hover:border-[#2B2D33]/20"
          >
            Share on LinkedIn
          </button>
        </div>
      </div>
    </section>
  );
}

function RoiSlider({ label, value, min, max, step, display, helper, onChange }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-[#2B2D33]">{label}</span>
        <span className="shrink-0 text-[13px] font-semibold text-[#2B2D33]">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer appearance-none rounded-full bg-[#E8E4DE] accent-[#A8C53A]"
      />
      {helper ? <p className="mt-1 text-[11px] text-[#6B6B6B]">{helper}</p> : null}
    </label>
  );
}

function RoiOutput({ label, value, sub, tone, large }) {
  const color = tone === "danger" ? "text-red-600" : "text-emerald-700";
  return (
    <div className="rounded-lg border border-[#E8E4DE] bg-white px-4 py-3">
      <p className="text-[12px] text-[#6B6B6B]">{label}</p>
      <p className={`mt-1 font-semibold ${color} ${large ? "text-3xl" : "text-xl"}`}>{value}</p>
      {sub ? <p className="mt-1 text-[11px] text-[#6B6B6B]">{sub}</p> : null}
    </div>
  );
}
