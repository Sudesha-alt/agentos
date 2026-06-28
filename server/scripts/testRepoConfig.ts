/** Default repo for local Ananta push/layer tests. Override via env. */
export const TEST_REPO_OWNER = process.env.TEST_REPO_OWNER?.trim() || "ZoroXRoronoa";
export const TEST_REPO_NAME = process.env.TEST_REPO_NAME?.trim() || "sudesh_anna_test";
export const TEST_REPO_BRANCH = process.env.TEST_REPO_BRANCH?.trim() || "test";
export const TEST_REPO_URL = `https://github.com/${TEST_REPO_OWNER}/${TEST_REPO_NAME}.git`;
