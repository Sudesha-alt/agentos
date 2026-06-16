import type { TechAgentHandoff } from "./handoff";
import { searchWorkFiles, type WorkFileHit } from "../../codebaseIntelligence/fileRanker";
import { FILE_WORK_THRESHOLD } from "../../codebaseIntelligence/retrievalConfig";
import type { AffectedFileEntry, PmAnalysisRecord } from "./types";

export interface HandoffRetrievalMeta {
  files: Array<{
    path: string;
    score: number;
    changeScope: string;
    matchReasons: string[];
  }>;
}

export async function refineHandoffFiles(
  handoff: TechAgentHandoff,
  record: PmAnalysisRecord
): Promise<TechAgentHandoff> {
  const ticketText = [
    handoff.cleanSummary,
    record.ticketInput.description,
    ...record.ticketInput.components,
  ]
    .filter(Boolean)
    .join(" ");

  const query = [
    handoff.suggestedFirstFile,
    ...handoff.affectedFiles.map((f) => f.path),
    handoff.cleanSummary,
  ]
    .filter(Boolean)
    .join(" ");

  const workFiles = await searchWorkFiles({
    query,
    branchName: handoff.branchName,
    ticketText,
    topN: 12,
  });

  const byPath = new Map(workFiles.map((f) => [f.path, f]));
  const llmPaths = new Set(handoff.affectedFiles.map((f) => f.path));
  const reconciled: AffectedFileEntry[] = [];

  for (const existing of handoff.affectedFiles) {
    const match = byPath.get(existing.path);
    if (match?.changeScope === "modify" && match.score < FILE_WORK_THRESHOLD) {
      continue;
    }
    reconciled.push({
      ...existing,
      changeScope: match?.changeScope ?? existing.changeScope ?? "modify",
      confidence: match ? Math.max(existing.confidence, match.score) : existing.confidence,
    });
  }

  for (const wf of workFiles) {
    if (llmPaths.has(wf.path)) continue;
    if (reconciled.length >= handoff.affectedFiles.length + 2) break;
    reconciled.push(workFileToAffectedEntry(wf));
  }

  const createNewFromLlm = handoff.affectedFiles.filter(
    (f) => f.changeScope === "create_new" && !byPath.has(f.path)
  );
  for (const entry of createNewFromLlm) {
    if (!reconciled.some((r) => r.path === entry.path)) {
      reconciled.push(entry);
    }
  }

  let suggestedFirstFile = handoff.suggestedFirstFile;
  let suggestedFirstFileReason = handoff.suggestedFirstFileReason;
  const topWork = workFiles[0];
  if (topWork && !reconciled.some((f) => f.path === suggestedFirstFile)) {
    suggestedFirstFile = topWork.path;
    suggestedFirstFileReason = `Re-ranked by semantic retrieval (${topWork.changeScope}, score ${topWork.score.toFixed(2)})`;
  }

  const retrievalMeta: HandoffRetrievalMeta = {
    files: workFiles.map((f) => ({
      path: f.path,
      score: f.score,
      changeScope: f.changeScope,
      matchReasons: f.matchReasons,
    })),
  };

  return {
    ...handoff,
    affectedFiles: reconciled,
    suggestedFirstFile,
    suggestedFirstFileReason,
    retrievalMeta,
  };
}

function workFileToAffectedEntry(wf: WorkFileHit): AffectedFileEntry {
  return {
    path: wf.path,
    reason: wf.matchReasons.join(", ") || "Semantic retrieval match",
    role: wf.changeScope === "create_new" ? "new" : "secondary",
    confidence: wf.score,
    riskLevel: "medium",
    changeScope: wf.changeScope,
  };
}
