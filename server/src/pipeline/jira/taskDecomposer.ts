import { getPipelineJiraClient } from "./client";
import { isAiWorkerEligibleIssueType } from "./aiWorkerIssueTypes";

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

/** AI Worker intake — queue Task/Bug tickets directly (no epic/story decomposition). */
export async function decomposeForPipelineIntake(
  rootKey: string
): Promise<DecomposedIntake> {
  const client = getPipelineJiraClient();
  const root = (await client.getIssueWithFields<HierarchyIssue>(
    rootKey,
    HIERARCHY_FIELDS
  )) as HierarchyIssue;

  const sourceIssueType = root.fields?.issuetype?.name ?? "Unknown";

  if (!isAiWorkerEligibleIssueType(sourceIssueType)) {
    return { sourceKey: rootKey, sourceIssueType, groups: [] };
  }

  return {
    sourceKey: rootKey,
    sourceIssueType,
    groups: [
      {
        storyKey: rootKey,
        storySummary: root.fields?.summary ?? rootKey,
        taskKeys: [rootKey],
      },
    ],
  };
}
