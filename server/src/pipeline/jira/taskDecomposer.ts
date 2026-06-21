import { getPipelineJiraClient } from "./client";
import { isAiWorkerEligibleIssueType } from "./aiWorkerIssueTypes";
import type { PipelineJiraIssue } from "./ticketNormalizer";

export interface StoryTaskGroup {
  storyKey: string;
  storySummary: string;
  taskKeys: string[];
}

export interface DecomposedIntake {
  sourceKey: string;
  sourceIssueType: string;
  groups: StoryTaskGroup[];
}

interface HierarchyIssue {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    issuetype?: { name?: string; subtask?: boolean };
    [key: string]: unknown;
  };
}

const HIERARCHY_FIELDS = ["summary", "issuetype"];

function decomposeFromIssue(root: HierarchyIssue): DecomposedIntake {
  const sourceIssueType = root.fields?.issuetype?.name ?? "Unknown";
  if (!isAiWorkerEligibleIssueType(sourceIssueType)) {
    return { sourceKey: root.key, sourceIssueType, groups: [] };
  }
  return {
    sourceKey: root.key,
    sourceIssueType,
    groups: [
      {
        storyKey: root.key,
        storySummary: root.fields?.summary ?? root.key,
        taskKeys: [root.key],
      },
    ],
  };
}

/** Decompose an already-fetched Jira issue (avoids a duplicate REST call). */
export function decomposeFromPipelineIssue(root: PipelineJiraIssue): DecomposedIntake {
  return decomposeFromIssue(root as HierarchyIssue);
}

/** AI Worker intake — queue Task/Bug tickets directly (no epic/story decomposition). */
export async function decomposeForPipelineIntake(
  rootKey: string
): Promise<DecomposedIntake> {
  const client = getPipelineJiraClient();
  const root = (await client.getIssueWithFields<HierarchyIssue>(
    rootKey,
    HIERARCHY_FIELDS
  )) as HierarchyIssue;

  return decomposeFromIssue(root);
}
