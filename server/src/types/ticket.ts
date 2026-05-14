export interface NormalizedTicket {
  jiraTicketId: string;
  jiraKey: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  reporter: string;
  assignee: string | null;
  labels: string[];
  epicLink: string | null;
  storyPoints: number | null;
  components: string[];
  createdAt: Date;
  projectKey: string;
}

export interface IntentClassification {
  requiresPipeline: boolean;
  skipReason?: string;
  confidence?: number;
}
