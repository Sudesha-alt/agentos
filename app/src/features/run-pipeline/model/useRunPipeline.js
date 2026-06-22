import { useState } from "react";
import { pipelineAdapter } from "../../../entities/pipeline";

export function useRunPipeline() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  async function run(ticketId) {
    setPending(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await pipelineAdapter.run(ticketId);
      setLastResult(result);
      if (result.started === false && (result.enqueued ?? 0) === 0) {
        const msg =
          result.message ??
          (result.skipped
            ? "Pipeline was not started — ticket may already be active, paused for review, or completed."
            : "Pipeline was not started.");
        const err = new Error(msg);
        setError(err);
        throw err;
      }
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  async function resume(pipelineId) {
    setPending(true);
    setError(null);
    setLastResult(null);
    try {
      const result = await pipelineAdapter.resume(pipelineId);
      setLastResult(result);
      if (result.started === false && !result.queued) {
        const err = new Error("Pipeline resume did not start — it may already be running.");
        setError(err);
        throw err;
      }
      return result;
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  return { run, resume, pending, error, lastResult };
}
