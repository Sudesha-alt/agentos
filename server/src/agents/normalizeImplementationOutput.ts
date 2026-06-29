import type { ImplementationMode, ImplementationOutput } from "../types/agents";

/** Coerce common LLM plan quirks before validation (especially content-mode docs). */
export function normalizeImplementationOutput(
  parsed: ImplementationOutput,
  mode: ImplementationMode,
  targetFiles: string[]
): ImplementationOutput {
  const components = (parsed.components ?? []).map((c) => ({
    ...c,
    estimatedDays:
      typeof c.estimatedDays === "number" && c.estimatedDays > 0 ? c.estimatedDays : 0.25,
  }));

  const componentSum = components.reduce((sum, c) => sum + c.estimatedDays, 0);
  const totalEstimateDays =
    typeof parsed.totalEstimateDays === "number" && parsed.totalEstimateDays > 0
      ? parsed.totalEstimateDays
      : Math.max(0.25, componentSum);

  const authoritativeTargetFiles =
    mode === "content" && targetFiles.length > 0
      ? targetFiles
      : parsed.targetFiles?.length
        ? parsed.targetFiles
        : targetFiles;

  return {
    ...parsed,
    implementationMode: parsed.implementationMode ?? mode,
    targetFiles: authoritativeTargetFiles,
    apiChanges: mode === "content" ? [] : parsed.apiChanges ?? [],
    databaseChanges: mode === "content" ? [] : parsed.databaseChanges ?? [],
    components: components.length
      ? components
      : mode === "content" && targetFiles.length
        ? targetFiles.map((path) => ({
            name: path.split("/").pop() ?? path,
            description: `Author or update ${path}`,
            estimatedDays: 0.25,
          }))
        : parsed.components,
    totalEstimateDays,
    blockers: parsed.blockers ?? [],
    dependencies: parsed.dependencies ?? [],
    risks: parsed.risks ?? [],
  };
}
