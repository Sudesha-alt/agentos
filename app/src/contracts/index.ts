import { z } from "zod";

export const TicketStatusSchema = z.enum([
  "RECEIVED",
  "PROCESSING",
  "AWAITING_HUMAN",
  "COMPLETED",
  "FAILED",
]);

export const PipelineStageSchema = z.enum([
  "INGESTION",
  "PRODUCT_AGENT",
  "PRD_VALIDATION",
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
  "QA_AGENT",
  "QA_VALIDATION",
  "OUTPUT",
]);

export const PipelineStatusSchema = z.enum([
  "RUNNING",
  "PAUSED",
  "COMPLETED",
  "FAILED",
]);

export const StageStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "AWAITING_HUMAN",
]);

export const ValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(["error", "warning"]),
  path: z.string().optional(),
});

export const ValidationResultSchema = z.object({
  passed: z.boolean(),
  score: z.number(),
  issues: z.array(ValidationIssueSchema),
  amberFlags: z.array(z.string()),
  checkedAt: z.string(),
});

export const TicketSchema = z.object({
  id: z.string().optional(),
  jiraTicketId: z.string().optional(),
  jiraKey: z.string(),
  rawPayload: z.unknown().optional(),
  normalizedData: z.record(z.string(), z.unknown()).catch({}),
  status: TicketStatusSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export const PipelineStageLogSchema = z.object({
  id: z.string(),
  pipelineId: z.string().optional(),
  stage: PipelineStageSchema,
  status: StageStatusSchema,
  input: z.unknown(),
  output: z.unknown().nullable().optional(),
  validationResult: ValidationResultSchema.nullable().optional(),
  confidenceScore: z.number().nullable().optional(),
  tokenCount: z.number().nullable().optional(),
  costUsd: z.number().nullable().optional(),
  startedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const HumanOverrideSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  stage: PipelineStageSchema,
  originalOutput: z.unknown(),
  correctedOutput: z.unknown(),
  reason: z.string().nullable().optional(),
  overriddenBy: z.string(),
  overriddenAt: z.string(),
});

export const AuditLogSchema = z.object({
  id: z.string().optional(),
  pipelineId: z.string().optional(),
  event: z.string(),
  metadata: z.record(z.string(), z.unknown()).catch({}),
  timestamp: z.string(),
});

export const PipelineSummarySchema = z.object({
  id: z.string(),
  ticketId: z.string(),
  currentStage: PipelineStageSchema,
  status: PipelineStatusSchema,
  startedAt: z.string(),
  completedAt: z.string().nullable().optional(),
  ticket: TicketSchema.optional(),
});

export const PipelineDetailSchema = PipelineSummarySchema.extend({
  ticket: TicketSchema,
  stages: z.array(PipelineStageLogSchema),
  overrides: z.array(HumanOverrideSchema).optional().default([]),
  auditLogs: z.array(AuditLogSchema).optional().default([]),
});

export const PipelineListResponseSchema = z.object({
  items: z.array(PipelineSummarySchema),
});

export const AuditListResponseSchema = z.object({
  items: z.array(AuditLogSchema),
});

export const ReadinessResponseSchema = z.object({
  status: z.enum(["ready", "degraded", "ok"]),
  timestamp: z.string().optional(),
  checks: z.record(z.string(), z.string()).optional(),
});

export const RunPipelineResponseSchema = z.object({
  jobId: z.union([z.string(), z.number()]),
  ticketId: z.string(),
});

export const SubmitOverrideRequestSchema = z.object({
  stage: PipelineStageSchema,
  correctedOutput: z.record(z.string(), z.unknown()),
  overriddenBy: z.string().min(1),
  reason: z.string().optional(),
});

export const SubmitOverrideResponseSchema = z.object({
  ok: z.boolean(),
});

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  organizationId: z.string().optional(),
  organizationName: z.string().optional(),
  organizationDomain: z.string().optional(),
  organizationSlug: z.string().optional(),
  organizationRole: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
});

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  slug: z.string(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
});

export const OnboardingProfileSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
  companyStage: z
    .enum(["idea", "mvp", "growth", "scale", "enterprise"])
    .nullable(),
  teamSize: z.enum(["solo", "2-10", "11-50", "51-200", "200+"]).nullable(),
  role: z
    .enum(["founder", "product", "engineering", "engineering_lead", "ops", "other"])
    .nullable(),
  completed: z.boolean(),
  completedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});

export const AuthSessionSchema = z.object({
  token: z.string(),
  issuedAt: z.string(),
  user: AuthUserSchema,
  organization: OrganizationSchema.optional(),
  onboardingCompleted: z.boolean().optional(),
});

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const SignupRequestSchema = LoginRequestSchema;

export const LoginResponseSchema = AuthSessionSchema;

export const SettingsSchema = z.object({
  jiraBaseUrl: z.string(),
  jiraEmail: z.string(),
  jiraApiToken: z.string(),
  webhookSecret: z.string(),
  model: z.string(),
  prdConfidenceThreshold: z.number(),
  implementationConfidenceThreshold: z.number(),
  qaCoverageThreshold: z.number(),
  systemDesignComplexityThreshold: z.number(),
  canaryStagingBaseUrl: z.string(),
  canaryProductionBaseUrl: z.string(),
  canaryAuthToken: z.string(),
});

export type TicketStatus = z.infer<typeof TicketStatusSchema>;
export type PipelineStage = z.infer<typeof PipelineStageSchema>;
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
export type StageStatus = z.infer<typeof StageStatusSchema>;
export type ValidationIssueDto = z.infer<typeof ValidationIssueSchema>;
export type ValidationResultDto = z.infer<typeof ValidationResultSchema>;
export type TicketDto = z.infer<typeof TicketSchema>;
export type PipelineStageLogDto = z.infer<typeof PipelineStageLogSchema>;
export type HumanOverrideDto = z.infer<typeof HumanOverrideSchema>;
export type AuditLogDto = z.infer<typeof AuditLogSchema>;
export type PipelineSummaryDto = z.infer<typeof PipelineSummarySchema>;
export type PipelineDetailDto = z.infer<typeof PipelineDetailSchema>;
export type PipelineListResponseDto = z.infer<typeof PipelineListResponseSchema>;
export type AuditListResponseDto = z.infer<typeof AuditListResponseSchema>;
export type ReadinessResponseDto = z.infer<typeof ReadinessResponseSchema>;
export type RunPipelineResponseDto = z.infer<typeof RunPipelineResponseSchema>;
export type SubmitOverrideRequestDto = z.infer<typeof SubmitOverrideRequestSchema>;
export type SubmitOverrideResponseDto = z.infer<typeof SubmitOverrideResponseSchema>;
export type AuthUserDto = z.infer<typeof AuthUserSchema>;
export type AuthSessionDto = z.infer<typeof AuthSessionSchema>;
export type LoginRequestDto = z.infer<typeof LoginRequestSchema>;
export type LoginResponseDto = z.infer<typeof LoginResponseSchema>;
export type SettingsDto = z.infer<typeof SettingsSchema>;
