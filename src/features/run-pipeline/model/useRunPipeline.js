import { useState } from "react";
import { pipelineAdapter } from "../../../entities/pipeline";

export function useRunPipeline() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function run(ticketId) {
    setPending(true);
    setError(null);
    try {
      return await pipelineAdapter.run(ticketId);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  return { run, pending, error };
}
