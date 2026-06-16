import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { EASE } from "../../lib/motion";

export default function SettingsSectionsWidget({
  form,
  onChange,
  onSubmit,
  pending,
  savedAt,
  error,
  mode = "full",
}) {
  const pipelineOnly = mode === "pipeline";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!pipelineOnly ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
        >
          <Panel>
            <PanelHeader
              kicker="Integrations"
              title="Integrations hub"
            />
            <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
              <IntegrationCard
                to="/app/settings/integrations/jira"
                title="Jira integration"
              />
              <IntegrationCard
                to="/app/settings/integrations/github"
                title="GitHub integration"
              />
            </div>
          </Panel>
        </motion.div>
      ) : null}

      {!pipelineOnly ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EASE, delay: 0.04 }}
        >
          <Panel>
            <PanelHeader
              kicker="Integration"
              title="Jira"
            />
            <div className="px-5 py-4 sm:px-6">
              <Link
                to="/app/settings/integrations/jira"
                className="text-[13px] font-medium text-indigo hover:underline"
              >
                Open Jira settings →
              </Link>
            </div>
          </Panel>
        </motion.div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.06 }}
      >
        <Panel>
          <PanelHeader
            kicker="Quality"
            title="Canary QA"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Staging base URL"
              value={form.canaryStagingBaseUrl}
              placeholder="https://staging.example.com"
              onChange={(value) => onChange("canaryStagingBaseUrl", value)}
            />
            <Field
              label="Production base URL"
              value={form.canaryProductionBaseUrl}
              placeholder="https://app.example.com (optional)"
              onChange={(value) => onChange("canaryProductionBaseUrl", value)}
            />
            <Field
              label="Canary auth token"
              type="password"
              value={form.canaryAuthToken}
              placeholder="Bearer token for synthetic user (optional)"
              onChange={(value) => onChange("canaryAuthToken", value)}
            />
          </div>
        </Panel>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
      >
        <Panel>
          <PanelHeader
            kicker="Reasoning"
            title="Model and gate thresholds"
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
            <Field
              label="Model"
              value={form.model}
              onChange={(value) => onChange("model", value)}
            />
            <Field
              label="PRD confidence ≥"
              value={String(form.prdConfidenceThreshold)}
              onChange={(value) => onChange("prdConfidenceThreshold", clamp(value, 0, 1))}
            />
            <Field
              label="Implementation confidence ≥"
              value={String(form.implementationConfidenceThreshold)}
              onChange={(value) =>
                onChange("implementationConfidenceThreshold", clamp(value, 0, 1))
              }
            />
            <Field
              label="QA coverage ≥ (%)"
              value={String(form.qaCoverageThreshold)}
              onChange={(value) => onChange("qaCoverageThreshold", clamp(value, 0, 100))}
            />
            <Field
              label="System design complexity ≥"
              value={String(form.systemDesignComplexityThreshold ?? 5)}
              onChange={(value) =>
                onChange("systemDesignComplexityThreshold", clamp(value, 1, 10))
              }
            />
          </div>
        </Panel>
      </motion.div>

      <div className="flex flex-col items-end gap-2">
        {error ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-danger">
            {error}
          </p>
        ) : null}
        {savedAt ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-success">
            Saved · {savedAt.toLocaleTimeString()}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="btn-trace inline-flex items-center gap-2 rounded-full border border-indigo/50 bg-indigo/15 px-5 py-2.5 text-[13px] text-ink transition-all hover:shadow-glow-indigo disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function clamp(value, min, max) {
  const next = Number(value);
  if (Number.isNaN(next)) return min;
  return Math.max(min, Math.min(max, next));
}

function IntegrationCard({ to, title, description }) {
  return (
    <Link
      to={to}
      className="block rounded-[1rem] border border-hairline bg-surface/40 p-4 transition-colors hover:border-indigo/40 hover:bg-surface/60"
    >
      <p className="font-display text-[1.05rem] tracking-tight text-ink">{title}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{description}</p>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-indigo">
        Open →
      </p>
    </Link>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-full border border-hairline bg-surface/40 px-4 text-[13px] text-ink outline-none placeholder:text-ink-mute focus:border-indigo/50"
      />
    </label>
  );
}
