import { useState } from "react";
import {
  fetchCompanyFromWeb,
  fetchCompetitorsFromWeb,
  generateCompanyContext,
  saveCompanyProfile,
  useCompanyProfile,
} from "../../entities/company-intelligence";
import { AGENT_NAMES } from "../../shared/config/app";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { TitleWithInfo } from "../../shared/ui/InfoTip";
import { SettingsPageShell } from "../layout/SettingsPageShell";

function linesToArray(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

function arrayToLines(arr) {
  return (arr ?? []).join("\n");
}

function Field({ label, info, children }) {
  return (
    <label className="block">
      <span className="type-kicker inline-flex items-center gap-1.5">
        <TitleWithInfo info={info}>{label}</TitleWithInfo>
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export default function CompanyIntelligence({ embedded = false }) {
  const { data, loading, refetch } = useCompanyProfile();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fetchingWeb, setFetchingWeb] = useState(false);
  const [fetchingCompetitors, setFetchingCompetitors] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [genMeta, setGenMeta] = useState(null);
  const [webMeta, setWebMeta] = useState(null);
  const [competitorMeta, setCompetitorMeta] = useState(null);

  if (!form && data) {
    setForm({
      ...data,
      strategicGoalsText: arrayToLines(data.strategicGoals),
      nonGoalsText: arrayToLines(data.nonGoals),
      competitors: data.competitors ?? [],
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
      competitors: form.competitors ?? [],
    };
  }

  function updateCompetitor(index, field, value) {
    setForm((f) => {
      const list = [...(f.competitors ?? [])];
      list[index] = { ...list[index], [field]: value };
      return { ...f, competitors: list };
    });
  }

  function addCompetitor() {
    setForm((f) => ({
      ...f,
      competitors: [...(f.competitors ?? []), { name: "", website: "", description: "" }],
    }));
  }

  function removeCompetitor(index) {
    setForm((f) => ({
      ...f,
      competitors: (f.competitors ?? []).filter((_, i) => i !== index),
    }));
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
        competitors: profile.competitors ?? [],
      });
      setSavedAt(new Date());
      await refetch();
    } catch (err) {
      setError(err.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleFetchFromWeb() {
    const website = form?.website?.trim();
    if (!website) {
      setError("Enter a website URL first, then auto-fetch company details.");
      return;
    }
    setFetchingWeb(true);
    setError(null);
    try {
      const result = await fetchCompanyFromWeb({
        website,
        companyName: form?.companyName,
        profile: toPayload(),
      });
      const { suggested } = result;
      setWebMeta({
        technologies: result.technologies,
        confidenceNotes: result.confidenceNotes,
        sources: result.sources,
        model: result.model,
        costUsd: result.costUsd,
      });
      setForm({
        ...form,
        companyName: suggested.companyName ?? form.companyName,
        website: suggested.website ?? form.website,
        productSummary: suggested.productSummary ?? form.productSummary,
        icp: suggested.icp ?? form.icp,
        revenueModel: suggested.revenueModel ?? form.revenueModel,
        pricingSummary: suggested.pricingSummary ?? form.pricingSummary,
        strategicGoalsText: arrayToLines(suggested.strategicGoals ?? linesToArray(form.strategicGoalsText)),
        nonGoalsText: arrayToLines(suggested.nonGoals ?? linesToArray(form.nonGoalsText)),
      });
    } catch (err) {
      setError(err.message ?? "Web fetch failed");
    } finally {
      setFetchingWeb(false);
    }
  }

  async function handleFetchCompetitors() {
    const website = form?.website?.trim();
    if (!website) {
      setError("Enter a website URL first, then fetch competitors.");
      return;
    }
    setFetchingCompetitors(true);
    setError(null);
    try {
      const result = await fetchCompetitorsFromWeb({
        website,
        companyName: form?.companyName,
        productSummary: form?.productSummary,
        profile: toPayload(),
      });
      setCompetitorMeta({
        model: result.model,
        costUsd: result.costUsd,
        sources: result.sources,
      });
      setForm({
        ...form,
        competitors: result.competitors ?? result.suggested?.competitors ?? [],
      });
    } catch (err) {
      setError(err.message ?? "Competitor fetch failed");
    } finally {
      setFetchingCompetitors(false);
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
        competitors: profile.competitors ?? [],
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
    <SettingsPageShell
      embedded={embedded}
      backTo="/app/settings/plan"
      backLabel="← Settings"
      kicker="Business intelligence"
      title="Company profile"
      info={`Start with your website — we scrape public pages and pre-fill company details. ${AGENT_NAMES.VIRIN} validates every idea against this before writing a PRD.`}
    >

      <form onSubmit={handleSave} className="space-y-5">
        <Panel>
          <PanelHeader
            kicker="Basics"
            title="Company details"
            info="Auto-fetch from your public website, then edit any field that looks wrong."
            right={
              <button
                type="button"
                disabled={fetchingWeb || !form?.website?.trim()}
                onClick={handleFetchFromWeb}
                className="rounded-full border border-indigo/30 bg-indigo/10 px-4 py-2 text-[12px] font-medium text-indigo transition hover:bg-indigo/15 disabled:opacity-50"
              >
                {fetchingWeb ? "Fetching…" : "Auto-fetch from web"}
              </button>
            }
          />
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
            <Field label="Website" info="Homepage URL — used for Jina Reader + meta scraping.">
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
                info="Product, platform, or service in plain language."
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
          {webMeta && (
            <div className="border-t border-app-border px-5 py-4 sm:px-6">
              <p className="text-[12px] text-app-ink-mute">
                Fetched with {webMeta.technologies?.join(" · ")}
                {webMeta.model ? ` · ${webMeta.model}` : ""}
                {webMeta.costUsd != null ? ` · $${webMeta.costUsd.toFixed(4)}` : ""}
              </p>
              {webMeta.confidenceNotes ? (
                <p className="mt-2 text-[13px] leading-relaxed text-app-ink-dim">
                  {webMeta.confidenceNotes}
                </p>
              ) : null}
              {webMeta.sources?.length ? (
                <p className="mt-2 font-mono text-[10px] text-app-ink-mute">
                  {webMeta.sources.filter((s) => s.ok).length} of {webMeta.sources.length} pages
                  scraped
                </p>
              ) : null}
              <p className="mt-2 text-[12px] text-warning">
                Review all fields below — scraped data can be incomplete or outdated.
              </p>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader
            kicker="Revenue"
            title="How you make money"
            info={`${AGENT_NAMES.VIRIN} uses this to judge revenue impact and prioritization.`}
          />
          <div className="grid gap-5 px-5 py-5 sm:px-6">
            <Field
              label="Revenue model"
              info="Subscription, usage-based, services, marketplace take-rate, etc."
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
            <Field label="Strategic goals" info="One per line — replaces hardcoded OKRs.">
              <textarea
                value={form?.strategicGoalsText ?? ""}
                onChange={(e) => update("strategicGoalsText", e.target.value)}
                rows={5}
                className={`${inputClass} resize-y font-mono text-[13px]`}
                placeholder={"Reduce enterprise churn\nShip self-serve admin\nExpand API revenue"}
              />
            </Field>
            <Field label="Company non-goals" info="Ideas that conflict with these get flagged.">
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

        <Panel>
          <PanelHeader
            kicker="Market"
            title="Competitors"
            info={`${AGENT_NAMES.VIRIN} can analyze how competitors solve similar problems during discovery.`}
            right={
              <button
                type="button"
                disabled={fetchingCompetitors || !form?.website?.trim()}
                onClick={handleFetchCompetitors}
                className="rounded-full border border-indigo/30 bg-indigo/10 px-4 py-2 text-[12px] font-medium text-indigo transition hover:bg-indigo/15 disabled:opacity-50"
              >
                {fetchingCompetitors ? "Fetching…" : "Fetch competitors from web"}
              </button>
            }
          />
          <div className="space-y-4 px-5 py-5 sm:px-6">
            {(form?.competitors ?? []).length === 0 ? (
              <p className="text-[13px] text-app-ink-mute">
                No competitors yet — fetch from web or add manually.
              </p>
            ) : (
              (form.competitors ?? []).map((comp, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-app-sm border border-app-border bg-app-surface-muted/20 p-4 sm:grid-cols-[1fr_1fr_1.2fr_auto]"
                >
                  <Field label="Name">
                    <input
                      type="text"
                      value={comp.name ?? ""}
                      onChange={(e) => updateCompetitor(index, "name", e.target.value)}
                      placeholder="Rival Inc"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Website">
                    <input
                      type="url"
                      value={comp.website ?? ""}
                      onChange={(e) => updateCompetitor(index, "website", e.target.value)}
                      placeholder="https://rival.com"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Description">
                    <input
                      type="text"
                      value={comp.description ?? ""}
                      onChange={(e) => updateCompetitor(index, "description", e.target.value)}
                      placeholder="What they offer in this space"
                      className={inputClass}
                    />
                  </Field>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeCompetitor(index)}
                      className="rounded-full border border-danger/30 px-3 py-2 text-[12px] text-danger transition hover:bg-danger/5"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              type="button"
              onClick={addCompetitor}
              className="rounded-full border border-app-border px-4 py-2 text-[12px] text-app-ink-dim transition hover:border-indigo/30 hover:text-indigo"
            >
              + Add competitor
            </button>
          </div>
          {competitorMeta && (
            <div className="border-t border-app-border px-5 py-4 sm:px-6">
              <p className="text-[12px] text-app-ink-mute">
                Discovered with {competitorMeta.model ?? "web search"}
                {competitorMeta.costUsd != null ? ` · $${competitorMeta.costUsd.toFixed(4)}` : ""}
                {competitorMeta.sources?.length
                  ? ` · ${competitorMeta.sources.filter((s) => s.ok).length} sources`
                  : ""}
              </p>
            </div>
          )}
        </Panel>

        <Panel className="border-indigo/20">
          <PanelHeader
            kicker="Generated · editable"
            title="Business context"
            info={`Inferred from your indexed codebase. Edit freely — ${AGENT_NAMES.VIRIN} reads this verbatim.`}
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
    </SettingsPageShell>
  );
}
