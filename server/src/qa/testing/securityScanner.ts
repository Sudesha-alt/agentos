import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../../utils/logger";
import { sandboxManager } from "./sandboxManager";

const execAsync = promisify(exec);

export interface SecurityFinding {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  source: "npm_audit" | "security_test" | "script";
  detail: string;
}

export interface SecurityScanResult {
  runId: string;
  status: "completed" | "skipped" | "error";
  criticalCount: number;
  highCount: number;
  findings: SecurityFinding[];
  sandboxAvailable: boolean;
  message?: string;
  rawAudit?: unknown;
}

export function isQaSecurityGateStrict(): boolean {
  return process.env.QA_SECURITY_GATE_STRICT !== "false";
}

export async function runSecurityScanInSandbox(input: {
  branchName: string;
  timeoutSeconds?: number;
}): Promise<SecurityScanResult> {
  const runId = `sec-${Date.now()}`;
  const findings: SecurityFinding[] = [];

  if (!process.env.GITHUB_TOKEN) {
    return {
      runId,
      status: "skipped",
      criticalCount: 0,
      highCount: 0,
      findings: [],
      sandboxAvailable: false,
      message: "Security scan skipped: GITHUB_TOKEN not configured.",
    };
  }

  const { sandboxDir } = sandboxManager.create(runId);
  const timeout = (input.timeoutSeconds ?? 120) * 1000;

  try {
    await sandboxManager.cloneBranch(sandboxDir, input.branchName);
    await sandboxManager.installDependencies(sandboxDir);

    const auditFindings = await runNpmAudit(sandboxDir, timeout);
    findings.push(...auditFindings);

    const scriptFindings = await runOptionalSecurityScript(sandboxDir, timeout);
    findings.push(...scriptFindings);

    const securityTestFindings = await runSecurityTaggedTests(sandboxDir, timeout);
    findings.push(...securityTestFindings);

    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;

    return {
      runId,
      status: "completed",
      criticalCount,
      highCount,
      findings,
      sandboxAvailable: true,
    };
  } catch (err) {
    logger.warn({ err, runId }, "security scan failed");
    return {
      runId,
      status: "error",
      criticalCount: 0,
      highCount: 0,
      findings,
      sandboxAvailable: true,
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    sandboxManager.destroy(sandboxDir);
  }
}

async function runNpmAudit(
  sandboxDir: string,
  timeout: number
): Promise<SecurityFinding[]> {
  const findings: SecurityFinding[] = [];
  const lockfile = existsSync(join(sandboxDir, "package-lock.json"))
    ? "npm"
    : existsSync(join(sandboxDir, "pnpm-lock.yaml"))
      ? "pnpm"
      : null;

  if (!lockfile || !existsSync(join(sandboxDir, "package.json"))) {
    return findings;
  }

  try {
    const cmd =
      lockfile === "pnpm"
        ? "pnpm audit --json"
        : "npm audit --json";
    const { stdout } = await execAsync(cmd, {
      cwd: sandboxDir,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as {
      vulnerabilities?: Record<
        string,
        { severity?: string; name?: string; via?: unknown[] }
      >;
    };

    for (const [name, vuln] of Object.entries(parsed.vulnerabilities ?? {})) {
      const sev = mapAuditSeverity(vuln.severity);
      if (sev === "low" || sev === "medium") continue;
      findings.push({
        id: `audit-${name}`,
        title: `Dependency vulnerability: ${vuln.name ?? name}`,
        severity: sev,
        source: "npm_audit",
        detail: `npm audit reported ${vuln.severity ?? "unknown"} on ${name}`,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ERESOLVE|audit.*failed|vulnerabilities found/i.test(message)) {
      findings.push({
        id: "audit-exit-nonzero",
        title: "npm audit reported vulnerabilities",
        severity: "high",
        source: "npm_audit",
        detail: message.slice(0, 500),
      });
    } else {
      logger.debug({ err }, "npm audit parse skipped");
    }
  }

  return findings;
}

async function runOptionalSecurityScript(
  sandboxDir: string,
  timeout: number
): Promise<SecurityFinding[]> {
  try {
    const pkg = JSON.parse(
      await import("node:fs/promises").then((fs) =>
        fs.readFile(join(sandboxDir, "package.json"), "utf8")
      )
    ) as { scripts?: Record<string, string> };

    if (!pkg.scripts?.security) return [];

    const { stderr, stdout } = await execAsync("npm run security", {
      cwd: sandboxDir,
      timeout,
      maxBuffer: 5 * 1024 * 1024,
    });
    const combined = `${stdout}\n${stderr}`;
    if (/critical|high severity/i.test(combined)) {
      return [
        {
          id: "script-security",
          title: "package.json security script reported issues",
          severity: /critical/i.test(combined) ? "critical" : "high",
          source: "script",
          detail: combined.slice(0, 500),
        },
      ];
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/security/i.test(message)) {
      return [
        {
          id: "script-security-fail",
          title: "security npm script failed",
          severity: "high",
          source: "script",
          detail: message.slice(0, 500),
        },
      ];
    }
  }
  return [];
}

async function runSecurityTaggedTests(
  sandboxDir: string,
  timeout: number
): Promise<SecurityFinding[]> {
  const patterns = [
    "**/*security*.test.*",
    "**/*sec*.test.*",
    "**/*.security.test.*",
  ];
  for (const pattern of patterns) {
    try {
      const cmd = `npx vitest run "${pattern}" --reporter=json 2>/dev/null || npx jest "${pattern}" --json 2>/dev/null || true`;
      const { stdout } = await execAsync(cmd, { cwd: sandboxDir, timeout });
      if (/\"numFailedTests\"\s*:\s*[1-9]/.test(stdout)) {
        return [
          {
            id: "security-tests-failed",
            title: "Security-tagged tests failed",
            severity: "critical",
            source: "security_test",
            detail: stdout.slice(0, 500),
          },
        ];
      }
    } catch {
      /* optional */
    }
  }
  return [];
}

function mapAuditSeverity(raw?: string): SecurityFinding["severity"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "critical") return "critical";
  if (s === "high") return "high";
  if (s === "moderate" || s === "medium") return "medium";
  return "low";
}

export function ticketRequiresSecurityTests(text: string): boolean {
  return /\b(auth|login|password|token|api|input|sql|xss|csrf|payment|secret|credential|upload)\b/i.test(
    text
  );
}
