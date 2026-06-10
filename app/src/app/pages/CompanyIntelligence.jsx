import { useState } from "react";
import {
  generateCompanyContext,
  saveCompanyProfile,
  useCompanyProfile,
} from "../../entities/company-intelligence";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

function linesToArray(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return (arr ?? []).join("\n");
}

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="type-kicker">{label}</span>
      {hint && <p className="mt-0.5 text-[12px] text-app-ink-mute">{hint}</p>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function CompanyIntelligence() {
  const { data, loading, refetch } = useCompanyProfile();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [genMeta, setGenMeta] = useState(null);

  if (!form && data) {
    setForm({
      ...data,
      strategicGoalsText: arrayToLines(data.strategicGoals),
      nonGoalsText: arrayToLines(data.nonGoals),
    });
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toPayload() {
    return {
      companyName: form.companyName,
      website: form.website,
      productSummary: form.productSummary,
      icp: form.icp,
      revenueModel: form.revenueModel,
      pricingSummary: form.pricingSummary,
      businessContext: form.businessContext,
      strategicGoals: linesToArray(form.strategicGoalsText),
      nonGoals: linesToArray(form.nonGoalsText),
    };
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const profile = await saveCompanyProfile(toPayload());
      setForm({
        ...profile,
        strategicGoalsText: arrayToLines(profile.strategicGoals),
        nonGoalsText: arrayToLines(profile.nonGoals),
      });
      setSavedAt(new Date());
      await refetch();
    } catch (err) {
      setError(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateCompanyContext(toPayload());
      const { profile } = result;
      setGenMeta({
        model: result.model,
        vectorHitsUsed: result.vectorHitsUsed,
        codebaseFilesIndexed: result.codebaseFilesIndexed,
        repoLabel: result.repoLabel,
        costUsd: result.costUsd,
      });
      setForm({
        ...profile,
        strategicGoalsText: arrayToLines(profile.strategicGoals),
        nonGoalsText: arrayToLines(profile.nonGoals),
      });
      setSavedAt(new Date());
      await refetch();
    } catch (err) {
      setError(err.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const inputClass =
    "w-full rounded-app-sm border border-app-border bg-app-surface px-4 py-2.5 text-[14px] text-app-ink outline-none transition focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10";

  if (loading && !form) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-app-ink-mute">Loading company profile…</p>
      </div>
    );
  }

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Business intelligence"
        title="Company profile"
        body="Business context is inferred from your indexed codebase — product domains, modules, and monetization signals. Neel validates every idea against this before writing a PRD."
      />

      <form onSubmit={handleSave} className="space-y-5">
        <Panel>
          <PanelHeader kicker="Basics" title="Company details" />
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <Field label="Company name">
              <input
                type="text"
                value={form?.companyName ?? ""}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Corp"
                className={inputClass}
              />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={form?.website ?? ""}
                onChange={(e) => update("website", e.target.value)}
                placeholder="https://acme.com"
                className={inputClass}
              />
            </Field>
            <div className="sm:col-span-2">
              <Field
                label="What you build"
                hint="Product, platform, or service in plain language."
              >
                <textarea
                  value={form?.productSummary ?? ""}
                  onChange={(e) => update("productSummary", e.target.value)}
                  rows={3}
                  className={`${inputClass} resize-y`}
                  placeholder="AI-native workflow automation for enterprise ops teams…"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Ideal customer (ICP)">
                <textarea
                  value={form?.icp ?? ""}
                  onChange={(e) => update("icp", e.target.value)}
                  rows={2}
                  className={`${inputClass} resize-y`}
                  placeholder="Mid-market B2B SaaS, 200–2000 employees, ops-led buying…"
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            kicker="Revenue"
            title="How you make money"
            body="Neel uses this to judge revenue impact and prioritization."
          />
          <div className="grid gap-5 px-5 py-5 sm:px-6">
            <Field
              label="Revenue model"
              hint="Subscription, usage-based, services, marketplace take-rate, etc."
            >
              <textarea
                value={form?.revenueModel ?? ""}
                onChange={(e) => update("revenueModel", e.target.value)}
                rows={3}
                className={`${inputClass} resize-y`}
                placeholder="Annual SaaS contracts per workspace seat, plus usage overage on API calls…"
              />
            </Field>
            <Field label="Pricing & packaging">
              <textarea
                value={form?.pricingSummary ?? ""}
                onChange={(e) => update("pricingSummary", e.target.value)}
                rows={2}
                className={`${inputClass} resize-y`}
                placeholder="Starter $29/seat/mo, Growth $79, Enterprise custom…"
              />
            </Field>
          </div>
        </Panel>

        <Panel>
          <PanelHeader kicker="Strategy" title="Goals & boundaries" />
          <div className="grid gap-5 px-5 py-5 sm:grid-cols-2 sm:px-6">
            <Field label="Strategic goals" hint="One per line — replaces hardcoded OKRs.">
              <textarea
                value={form?.strategicGoalsText ?? ""}
                onChange={(e) => update("strategicGoalsText", e.target.value)}
                rows={5}
                className={`${inputClass} resize-y font-mono text-[13px]`}
                placeholder={"Reduce enterprise churn\nShip self-serve admin\nExpand API revenue"}
              />
            </Field>
            <Field label="Company non-goals" hint="Ideas that conflict with these get flagged.">
              <textarea
                value={form?.nonGoalsText ?? ""}
                onChange={(e) => update("nonGoalsText", e.target.value)}
                rows={5}
                className={`${inputClass} resize-y font-mono text-[13px]`}
                placeholder={"Consumer mobile app\nOn-prem only deployments"}
              />
            </Field>
          </div>
        </Panel>

        <Panel className="border-indigo/20">
          <PanelHeader
            kicker="Generated · editable"
            title="Business context"
            body="Inferred from your indexed codebase (architecture, modules, billing/product signals) with gpt-5.5. Edit freely — Neel reads this verbatim."
            right={
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="rounded-full border border-indigo/30 bg-indigo/10 px-4 py-2 text-[12px] font-medium text-indigo transition hover:bg-indigo/15 disabled:opacity-50"
              >
                {generating ? "Generating…" : "Generate from codebase"}
              </button>
            }
          />
          <div className="px-5 py-5 sm:px-6">
            <textarea
              value={form?.businessContext ?? ""}
              onChange={(e) => update("businessContext", e.target.value)}
              rows={12}
              className={`${inputClass} resize-y leading-relaxed`}
              placeholder="Connect GitHub, index the repo, then Generate from codebase — or write your own business context here."
            />
          </div>
        </Panel>

        {genMeta && (
          <p className="text-[12px] text-app-ink-mute">
            Generated with {genMeta.model ?? "premium model"}
            {genMeta.repoLabel ? ` · ${genMeta.repoLabel}` : ""}
            {genMeta.codebaseFilesIndexed != null
              ? ` · ${genMeta.codebaseFilesIndexed} indexed files`
              : ""}
            {genMeta.vectorHitsUsed != null && genMeta.vectorHitsUsed > 0
              ? ` · ${genMeta.vectorHitsUsed} vector supplement${genMeta.vectorHitsUsed === 1 ? "" : "s"}`
              : ""}
            {genMeta.costUsd != null ? ` · $${genMeta.costUsd.toFixed(4)}` : ""}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={saving} className="app-btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save company profile"}
          </button>
          {savedAt && (
            <span className="text-[12px] text-success">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          )}
          {error && <span className="text-[13px] text-danger">{error}</span>}
        </div>
      </form>
    </AnimatedAppPage>
  );
}
