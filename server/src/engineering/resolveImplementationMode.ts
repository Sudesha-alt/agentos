import {
  collectVerifiedRepoPaths,
  filterToVerifiedPaths,
} from "../agents/pm/verifiedRepoPaths";
import type { GeneratedPRD } from "../prd/prdGenerator";
import type { ImplementationMode } from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";

const CONTENT_KEYWORDS =
  /\b(curriculum|documentation|document|playbook|policy|content|markdown|\.md|guide|handbook|readme|wiki)\b/i;

const DOC_EXTENSIONS = /\.(md|mdx|txt|rst|adoc)$/i;

export interface ResolveImplementationModeInput {
  generatedPrd?: GeneratedPRD | null;
  pmContext?: PmPipelineContext | null;
  ticket?: Pick<NormalizedTicket, "summary" | "description" | "labels"> | null;
}

export function resolveImplementationMode(
  input: ResolveImplementationModeInput
): ImplementationMode {
  const fromPrd = input.generatedPrd?.implementationMode;
  if (fromPrd === "content" || fromPrd === "code") {
    return fromPrd;
  }

  const labels = input.ticket?.labels ?? [];
  if (labels.some((l) => l.toLowerCase() === "agentos:content")) return "content";
  if (labels.some((l) => l.toLowerCase() === "agentos:code")) return "code";

  const codebaseAnalysis = input.pmContext?.enrichedPrdDocument?.pmCodebaseAnalysis as
    | { suggestedImplementationMode?: string }
    | undefined;
  if (codebaseAnalysis?.suggestedImplementationMode === "content") return "content";
  if (codebaseAnalysis?.suggestedImplementationMode === "code") return "code";

  const deliverableFiles =
    input.generatedPrd?.deliverableFiles ??
    input.pmContext?.generatedPrd?.deliverableFiles ??
    [];
  if (deliverableFiles.length > 0) {
    const allDocPaths = deliverableFiles.every((f) => DOC_EXTENSIONS.test(f.path));
    if (allDocPaths) return "content";
  }

  const text = `${input.ticket?.summary ?? ""} ${input.ticket?.description ?? ""}`.trim();
  if (CONTENT_KEYWORDS.test(text)) {
    const endpoints = input.generatedPrd?.technicalRequirements?.endpoints ?? [];
    if (endpoints.length === 0) return "content";
  }

  return "code";
}

export function resolveDeliverableFiles(input: ResolveImplementationModeInput): Array<{
  path: string;
  format: string;
  purpose: string;
}> {
  const fromPrd =
    input.generatedPrd?.deliverableFiles ??
    input.pmContext?.generatedPrd?.deliverableFiles ??
    [];
  if (fromPrd.length) return fromPrd;

  const tasks = input.pmContext?.enrichedPrdDocument?.pmTaskBreakdown as
    | Array<{ files?: string[] }>
    | null
    | undefined;
  const taskPaths = [...new Set((tasks ?? []).flatMap((t) => t.files ?? []))].filter(Boolean);
  const verified = collectVerifiedRepoPaths(input.pmContext ?? null);
  const authoritativeTaskPaths = filterToVerifiedPaths(taskPaths, verified);
  if (authoritativeTaskPaths.length && resolveImplementationMode(input) === "content") {
    return authoritativeTaskPaths.map((path) => ({
      path,
      format: path.endsWith(".md") ? "markdown" : "document",
      purpose: "Required deliverable from task breakdown",
    }));
  }

  return [];
}

export function resolveTargetFilePaths(input: ResolveImplementationModeInput): string[] {
  return resolveDeliverableFiles(input).map((f) => f.path);
}
