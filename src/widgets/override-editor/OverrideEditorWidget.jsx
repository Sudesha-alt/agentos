import { motion } from "framer-motion";
import StatusPill from "../../app/components/StatusPill";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { EASE } from "../../lib/motion";

export default function OverrideEditorWidget({
  originalStageLabel,
  originalOutput,
  draft,
  onDraftChange,
  reviewer,
  onReviewerChange,
  reason,
  onReasonChange,
  error,
  pending,
  submitted,
  onSubmit,
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE }}
      >
        <Panel>
          <PanelHeader
            kicker="Original"
            title={originalStageLabel}
            right={<StatusPill status="COMPLETED" />}
          />
          <pre className="max-h-[540px] overflow-auto rounded-b-[1.25rem] bg-[#0A0A13]/85 p-4 font-mono text-[12px] leading-6 text-ink-dim">
            {originalOutput || "// no prior output to compare"}
          </pre>
        </Panel>
      </motion.div>

      <motion.form
        onSubmit={onSubmit}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: EASE, delay: 0.05 }}
      >
        <Panel>
          <PanelHeader
            kicker="Corrected"
            title="Your override"
            right={<StatusPill status="AWAITING_HUMAN" />}
          />
          <div className="space-y-4 px-5 py-4 sm:px-6">
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              spellCheck={false}
              rows={18}
              className="w-full resize-y rounded-[1.1rem] border border-hairline bg-[#0A0A13]/80 p-4 font-mono text-[12.5px] leading-6 text-ink outline-none focus:border-indigo/50"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Reviewer"
                value={reviewer}
                placeholder="you@team.com"
                onChange={onReviewerChange}
              />
              <Field
                label="Reason"
                value={reason}
                placeholder="why this override"
                onChange={onReasonChange}
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-danger/40 bg-danger/5 px-3 py-2 font-mono text-[12px] text-danger">
                {error}
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="editorial-kicker text-ink-mute">
                Submitting will resume the pipeline from this stage.
              </p>
              <button
                type="submit"
                disabled={pending || submitted}
                className="btn-trace inline-flex items-center gap-2 rounded-full border border-indigo/50 bg-indigo/15 px-5 py-2.5 text-[13px] text-ink transition-all hover:shadow-glow-indigo disabled:opacity-50"
              >
                {submitted ? "Resumed" : pending ? "Submitting…" : "Submit override"}
              </button>
            </div>
          </div>
        </Panel>
      </motion.form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-10 w-full rounded-full border border-hairline bg-surface/40 px-4 text-[13px] text-ink outline-none placeholder:text-ink-mute focus:border-indigo/50"
      />
    </label>
  );
}
