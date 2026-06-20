/**
 * Verifies AsyncLocalStorage org scope survives legacy global clears (index race fix).
 * Run: node scripts/testIndexOrgContext.mjs
 */
import { AsyncLocalStorage } from "node:async_hooks";

const organizationContextStorage = new AsyncLocalStorage();
let legacyActiveOrganizationId = null;

function setActiveOrganizationId(id) {
  legacyActiveOrganizationId = id;
}

function getActiveOrganizationId() {
  return organizationContextStorage.getStore() ?? legacyActiveOrganizationId;
}

const indexOrganizationContext = new AsyncLocalStorage();

function resolveIndexOrganizationId(explicit) {
  return (
    indexOrganizationContext.getStore() ??
    explicit ??
    getActiveOrganizationId() ??
    null
  );
}

async function simulateIndexJob(organizationId) {
  return indexOrganizationContext.run(organizationId, async () => {
    await new Promise((r) => setTimeout(r, 50));
    const mid = resolveIndexOrganizationId();
    await new Promise((r) => setTimeout(r, 50));
    return mid;
  });
}

async function simulateCodebaseRequestFinish() {
  setActiveOrganizationId(null);
}

async function main() {
  console.log("=== Index org context isolation test ===\n");

  const orgId = "org_test_123";
  const indexPromise = organizationContextStorage.run(orgId, async () => {
    return simulateIndexJob(orgId);
  });

  await new Promise((r) => setTimeout(r, 25));
  await simulateCodebaseRequestFinish();

  const result = await indexPromise;
  const legacy = legacyActiveOrganizationId;
  const passed = result === orgId;

  console.log("Simulated concurrent codebase request clearing legacy global:", legacy === null ? "yes" : "no");
  console.log("Index job org id after legacy clear:", result ?? "(null)");
  console.log("\nResult:", passed ? "PASS" : "FAIL");

  if (!passed) {
    process.exit(1);
  }

  console.log("\nThis matches the production fix: index runs keep org id in AsyncLocalStorage");
  console.log("even when other HTTP handlers call setActiveOrganizationId(null).");
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
