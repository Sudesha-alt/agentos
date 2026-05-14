import { useState } from "react";
import {
  SubmitOverrideRequestSchema,
  SubmitOverrideResponseSchema,
} from "../../../contracts";
import { DATA_MODE } from "../../../shared/config/app";
import { fetchJson } from "../../../shared/lib/fetchJson";
import { mockApi } from "../../../app/api/mock";

const BASE = "/api";

async function submitWithRest(pipelineId, payload) {
  return SubmitOverrideResponseSchema.parse(
    await fetchJson(`${BASE}/pipelines/${pipelineId}/override`, {
      method: "POST",
      body: JSON.stringify(SubmitOverrideRequestSchema.parse(payload)),
    })
  );
}

async function submitWithMock(pipelineId, payload) {
  return SubmitOverrideResponseSchema.parse(
    await mockApi.submitOverride(
      pipelineId,
      SubmitOverrideRequestSchema.parse(payload)
    )
  );
}

export function useSubmitOverride() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  async function submit(pipelineId, payload) {
    setPending(true);
    setError(null);
    try {
      return DATA_MODE === "rest"
        ? await submitWithRest(pipelineId, payload)
        : await submitWithMock(pipelineId, payload);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, error };
}
