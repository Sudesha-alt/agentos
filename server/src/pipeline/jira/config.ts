export interface PipelineJiraMirrorConfig {
  statuses: string[];
  issueTypes: string[];
  months: number;
  minDescriptionLength: number;
  maxComments: number;
}

export function getPipelineJiraMirrorConfig(): PipelineJiraMirrorConfig {
  return {
    statuses: (
      process.env.PIPELINE_JIRA_MIRROR_STATUSES ?? "Done,Closed,Resolved"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    issueTypes: (
      process.env.PIPELINE_JIRA_MIRROR_TYPES ?? "Story,Bug,Task"
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    months: Number(process.env.PIPELINE_JIRA_MIRROR_MONTHS ?? 12),
    minDescriptionLength: Number(
      process.env.PIPELINE_JIRA_MIRROR_MIN_DESC ?? 20
    ),
    maxComments: Number(process.env.PIPELINE_JIRA_MIRROR_MAX_COMMENTS ?? 15),
  };
}

export function mirrorEligibleStatus(statusName: string): boolean {
  const normalized = statusName.trim().toLowerCase();
  return getPipelineJiraMirrorConfig().statuses.some(
    (s) => s.toLowerCase() === normalized
  );
}

export function mirrorEligibleIssueType(issueType: string): boolean {
  const normalized = issueType.trim().toLowerCase();
  return getPipelineJiraMirrorConfig().issueTypes.some(
    (s) => s.toLowerCase() === normalized
  );
}
