import { pipelineAdapter } from "../../entities/pipeline";
import { auditAdapter } from "../../entities/audit";
import { systemAdapter } from "../../entities/system";
import { DATA_MODE } from "../../shared/config/app";

// Legacy compatibility shim. New code should import from resource-level entity
// modules instead of relying on one flat client object.
export const api = {
  listPipelines: (status) => pipelineAdapter.list(status),
  getPipeline: (id) => pipelineAdapter.detail(id),
  getAudit: (id) => auditAdapter.list(id),
  runPipeline: (ticketId) => pipelineAdapter.run(ticketId),
  submitOverride: async () => {
    throw new Error(
      "Use useSubmitOverride() from features/submit-override/model instead."
    );
  },
  readiness: () => systemAdapter.readiness(),
};

export const isMockMode = () => DATA_MODE === "mock";
