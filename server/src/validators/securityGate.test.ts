import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateSecurityGate,
  mergeSecurityGateIntoValidation,
} from "./securityGate";

describe("securityGate", () => {
  it("blocks on critical static findings", () => {
    const gate = evaluateSecurityGate({
      securityScan: {
        runId: "s1",
        status: "completed",
        criticalCount: 1,
        highCount: 0,
        findings: [],
        sandboxAvailable: true,
      },
      canaryCriticals: [],
      canarySkipped: false,
    });
    assert.equal(gate.blocked, true);
    assert.ok(gate.reasons.some((r) => r.includes("critical static")));
  });

  it("blocks on critical canary findings", () => {
    const gate = evaluateSecurityGate({
      securityScan: {
        runId: "s1",
        status: "completed",
        criticalCount: 0,
        highCount: 0,
        findings: [],
        sandboxAvailable: true,
      },
      canaryCriticals: [{ title: "Auth bypass", description: "..." }],
      canarySkipped: false,
    });
    assert.equal(gate.blocked, true);
  });

  it("merges gate failures into validation", () => {
    const merged = mergeSecurityGateIntoValidation(
      { passed: true, score: 1, issues: [], amberFlags: [], checkedAt: "" },
      {
        static: { critical: 1, high: 0, ran: true },
        canary: { critical: 0, ran: true },
        blocked: true,
        reasons: ["1 critical static security finding(s)."],
      }
    );
    assert.equal(merged.passed, false);
    assert.ok(merged.issues.some((i) => i.code === "SECURITY_GATE"));
  });
});
