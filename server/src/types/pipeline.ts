export type VectorContentType =
  | "ticket"
  | "prd"
  | "qa_report"
  | "implementation";

export interface RetrievedContext {
  jiraTicketId: string;
  jiraKey: string;
  contentType: VectorContentType;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface CompressedContext {
  text: string;
  tokenEstimate: number;
  chunksUsed: number;
  droppedChunks: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  severity: "error" | "warning";
  path?: string;
}

export interface ValidationResult {
  passed: boolean;
  score: number;
  issues: ValidationIssue[];
  amberFlags: string[];
  checkedAt: string;
}

export interface PipelineRunJob {
  ticketId: string;
}

export interface CodebaseIndexJob {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerType: "webhook" | "manual";
}
