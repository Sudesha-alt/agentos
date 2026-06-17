import type { QaOutput } from "../types/agents";
import type { ValidationIssue, ValidationResult } from "../types/pipeline";
import type { SecurityScanResult } from "../qa/testing/securityScanner";
import {
  isQaSecurityGateStrict,
  ticketRequiresSecurityTests,
} from "../qa/testing/securityScanner";
import { resolveCanaryTargetUrl } from "../canaryAgent/config";

export interface SecurityGateInput {
  securityScan?: SecurityScanResult | null;
  canaryCriticals?: Array<{ title: string; description: string }>;
  canarySkipped?: boolean;
  canarySkipReason?: string;
  qaOutput?: QaOutput;
  ticketText?: string;
}

export interface SecurityGateSummary {
  static: { critical: number; high: number; ran: boolean };
  canary: { critical: number; ran: boolean };
  blocked: boolean;
  reasons: string[];
}

export function evaluateSecurityGate(input: SecurityGateInput): SecurityGateSummary {
  const reasons: string[] = [];
  const strict = isQaSecurityGateStrict();

  const staticCritical = input.securityScan?.criticalCount ?? 0;
  const staticHigh = input.securityScan?.highCount ?? 0;
  const staticRan = input.securityScan?.status === "completed";

  if (strict && !staticRan && input.securityScan?.status !== "skipped") {
    reasons.push("Security scan did not complete — run_security_scan is required.");
  }
  if (staticCritical > 0) {
    reasons.push(`${staticCritical} critical static security finding(s).`);
  }

  const canaryCritical = input.canaryCriticals?.length ?? 0;
  const stagingUrl = resolveCanaryTargetUrl("staging");
  const canaryRan = !input.canarySkipped && canaryCritical >= 0;

  if (strict && !stagingUrl) {
    reasons.push(
      "Canary staging URL not configured — set CANARY_STAGING_URL or staging base URL in settings."
    );
  }
  if (input.canarySkipped && strict) {
    reasons.push(input.canarySkipReason ?? "Canary cycle did not run.");
  }
  if (canaryCritical > 0) {
    reasons.push(`${canaryCritical} critical Canary finding(s).`);
  }

  if (
    input.qaOutput &&
    input.ticketText &&
    ticketRequiresSecurityTests(input.ticketText) &&
    !input.qaOutput.testCases.some((tc) => tc.type === "security")
  ) {
    reasons.push(
      "Ticket touches auth/API/input surfaces but no security-type test case in QA output."
    );
  }

  const blocked =
    staticCritical > 0 ||
    canaryCritical > 0 ||
    (strict &&
      ((!staticRan && input.securityScan?.status !== "skipped") ||
        Boolean(input.canarySkipped) ||
        !stagingUrl ||
        Boolean(
          input.qaOutput &&
            input.ticketText &&
            ticketRequiresSecurityTests(input.ticketText) &&
            !input.qaOutput.testCases.some((tc) => tc.type === "security")
        )));

  return {
    static: { critical: staticCritical, high: staticHigh, ran: staticRan },
    canary: { critical: canaryCritical, ran: canaryRan },
    blocked,
    reasons,
  };
}

export function mergeSecurityGateIntoValidation(
  validation: ValidationResult,
  gate: SecurityGateSummary
): ValidationResult {
  if (!gate.blocked) return validation;

  const issues: ValidationIssue[] = [...validation.issues];
  for (const reason of gate.reasons) {
    if (
      reason.includes("critical") ||
      reason.includes("required") ||
      reason.includes("not configured") ||
      reason.includes("did not run") ||
      reason.includes("security-type")
    ) {
      issues.push({
        code: "SECURITY_GATE",
        severity: "error",
        message: reason,
      });
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  return {
    ...validation,
    passed: false,
    issues,
    score: Math.max(0, 1 - errorCount * 0.2),
  };
}
