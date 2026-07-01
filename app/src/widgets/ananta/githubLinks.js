export function buildGitHubBlobUrl(repo, branch, filePath) {
  if (!repo?.workspace || !repo?.repoSlug || !branch || !filePath) return null;
  const encodedBranch = encodeURIComponent(branch);
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `https://github.com/${repo.workspace}/${repo.repoSlug}/blob/${encodedBranch}/${encodedPath}`;
}

export function buildGitHubBranchUrl(repo, branch) {
  if (!repo?.workspace || !repo?.repoSlug || !branch) return null;
  return `https://github.com/${repo.workspace}/${repo.repoSlug}/tree/${encodeURIComponent(branch)}`;
}

export function buildGitHubCommitUrl(repo, sha) {
  if (!repo?.workspace || !repo?.repoSlug || !sha) return null;
  return `https://github.com/${repo.workspace}/${repo.repoSlug}/commit/${sha}`;
}

export function isMarkdownPath(path) {
  return /\.mdx?$/i.test(path ?? "");
}
