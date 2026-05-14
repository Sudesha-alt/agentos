import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Spinner from "../components/Spinner";
import StatusPill from "../components/StatusPill";
import { usePipelineDetail } from "../../entities/pipeline";
import { useSubmitOverride } from "../../features/submit-override/model/useSubmitOverride";
import { formatStageLabel } from "../../shared/lib/format";
import { PageIntro } from "../../shared/ui/Panel";
import OverrideEditorWidget from "../../widgets/override-editor/OverrideEditorWidget";

export default function Override() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { item, loading } = usePipelineDetail(id);
  const { submit, pending } = useSubmitOverride();

  const pausedStage = useMemo(
    () =>
      item?.stages?.find(
        (s) => s.status === "AWAITING_HUMAN" || s.status === "RUNNING"
      ) ?? item?.stages?.[0],
    [item]
  );

  // Find the agent stage right before the failed gate so we can show its
  // output as the "original" to be corrected.
  const correctingStage = useMemo(() => {
    if (!item || !pausedStage) return null;
    const order = item.stages.map((s) => s.stage);
    const idx = order.indexOf(pausedStage.stage);
    return item.stages[Math.max(idx - 1, 0)];
  }, [item, pausedStage]);

  const [draft, setDraft] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  // Seed the editor with the prior output the first time we see this stage.
  // React 19 explicitly supports setState-during-render for this "store
  // information from a previous render" pattern.
  const [seededStageId, setSeededStageId] = useState(null);
  if (correctingStage && correctingStage.id !== seededStageId) {
    setSeededStageId(correctingStage.id);
    if (correctingStage.output && !draft) {
      setDraft(JSON.stringify(correctingStage.output, null, 2));
    }
  }

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading pipeline" />
      </div>
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError(null);
    let parsed;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setError("Corrected output must be valid JSON.");
      return;
    }
    if (!reviewer.trim()) {
      setError("Please enter your name so the override is attributed.");
      return;
    }
    try {
      await submit(id, {
        stage: correctingStage.stage,
        correctedOutput: parsed,
        overriddenBy: reviewer.trim(),
        reason: reason.trim() || undefined,
      });
      setSubmitted(true);
      window.setTimeout(() => navigate(`/app/pipelines/${id}`), 1400);
    } catch (e) {
      setError(e?.message ?? "Override submission failed.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <header className="flex flex-col gap-3">
        <Link
          to={`/app/pipelines/${id}`}
          className="editorial-kicker text-ink-mute transition-colors hover:text-ink"
        >
          ← pipeline
        </Link>
        <PageIntro
          kicker="Override"
          title="Correct the agent output and resume the pipeline."
          body="Human intervention stays explicit: review the source artifact, make a bounded correction, and re-queue the flow with attribution."
          right={<StatusPill status={item?.status} />}
        />
      </header>

      <OverrideEditorWidget
        originalStageLabel={
          correctingStage ? formatStageLabel(correctingStage.stage) : "Agent output"
        }
        originalOutput={
          correctingStage?.output
            ? JSON.stringify(correctingStage.output, null, 2)
            : ""
        }
        draft={draft}
        onDraftChange={setDraft}
        reviewer={reviewer}
        onReviewerChange={setReviewer}
        reason={reason}
        onReasonChange={setReason}
        error={error}
        pending={pending}
        submitted={submitted}
        onSubmit={onSubmit}
      />
    </div>
  );
}
