import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useCodebaseDirectory,
  useCodebaseFile,
  useCodebaseFileConnections,
} from "../../entities/codebase";
import DirectoryTree from "./DirectoryTree";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

function Breadcrumb({ path, onNavigate }) {
  const segments = path ? path.split("/") : [];

  return (
    <nav className="flex flex-wrap items-center gap-1 px-4 py-3 font-mono text-[11px]">
      <button
        type="button"
        onClick={() => onNavigate("")}
        className="text-indigo hover:underline"
      >
        root
      </button>
      {segments.map((seg, i) => {
        const full = segments.slice(0, i + 1).join("/");
        return (
          <span key={full} className="flex items-center gap-1">
            <span className="text-ink-mute">/</span>
            <button
              type="button"
              onClick={() => onNavigate(full)}
              className={
                i === segments.length - 1
                  ? "text-ink"
                  : "text-indigo hover:underline"
              }
            >
              {seg}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function FileIntelligencePanel({ filePath, branch, onOpenFile }) {
  const { data: fileData, error: fileError, loading: fileLoading } = useCodebaseFile(
    filePath,
    branch
  );
  const { data: connections, loading: connLoading } = useCodebaseFileConnections(
    filePath,
    branch
  );

  const file = fileData?.file;

  if (!filePath) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="max-w-sm text-center text-[13px] text-ink-dim">
          Select a file from the tree to view its intelligence summary — exports,
          imports, patterns, and connections. Full file content is not loaded.
        </p>
      </div>
    );
  }

  if (fileLoading && !file) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading file…" />
      </div>
    );
  }

  if (fileError && !file) {
    return (
      <div className="p-6 text-[13px] text-danger">
        {fileError instanceof Error ? fileError.message : "Could not load file"}
      </div>
    );
  }

  if (!file) {
    return (
      <div className="p-6 text-[13px] text-ink-dim">
        File not indexed yet: <span className="font-mono text-ink">{filePath}</span>
      </div>
    );
  }

  const patterns = Array.isArray(file.patterns) ? file.patterns : [];
  const exports = Array.isArray(file.exports) ? file.exports : [];
  const imports = Array.isArray(file.imports) ? file.imports : [];

  return (
    <div className="space-y-0 divide-y divide-hairline overflow-y-auto">
      <section className="px-5 py-4 sm:px-6">
        <p className="font-mono text-[12px] text-indigo">{file.filePath}</p>
        <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
          {file.language ? <span>{file.language}</span> : null}
          {file.size ? <span>{file.size} lines</span> : null}
          {file.lastAuthor ? <span>{file.lastAuthor}</span> : null}
        </div>
        {file.summary ? (
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-dim">{file.summary}</p>
        ) : (
          <p className="mt-3 text-[13px] text-ink-mute">No AI summary yet.</p>
        )}
      </section>

      {patterns.length ? (
        <IntelligenceSection title="Patterns">
          <TagList items={patterns} />
        </IntelligenceSection>
      ) : null}

      {exports.length ? (
        <IntelligenceSection title="Exports">
          <ul className="space-y-1 font-mono text-[12px] text-ink-dim">
            {exports.map((exp, i) => (
              <li key={`${exp.name}-${i}`}>
                {exp.name}
                {exp.type ? (
                  <span className="ml-2 text-[10px] text-ink-mute">{exp.type}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </IntelligenceSection>
      ) : null}

      {imports.length ? (
        <IntelligenceSection title="Imports">
          <ul className="space-y-2 font-mono text-[12px]">
            {imports.map((imp, i) => (
              <li key={`${imp.from}-${i}`}>
                <span className="text-indigo">{imp.from}</span>
                {imp.items?.length ? (
                  <span className="ml-2 text-ink-mute">{imp.items.join(", ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </IntelligenceSection>
      ) : null}

      <IntelligenceSection title="Connections">
        {connLoading && !connections ? (
          <p className="font-mono text-[11px] text-ink-mute">Loading…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <ConnectionList
              label="Outgoing"
              items={connections?.outgoing ?? []}
              onOpenFile={onOpenFile}
            />
            <ConnectionList
              label="Incoming"
              items={connections?.incoming ?? []}
              onOpenFile={onOpenFile}
            />
          </div>
        )}
      </IntelligenceSection>

      {file.lastCommitMsg ? (
        <IntelligenceSection title="Last commit">
          <p className="font-mono text-[12px] text-ink-dim">{file.lastCommitMsg}</p>
          {file.lastCommitSha ? (
            <p className="mt-1 font-mono text-[10px] text-ink-mute">
              {file.lastCommitSha.slice(0, 7)}
            </p>
          ) : null}
        </IntelligenceSection>
      ) : null}
    </div>
  );
}

function IntelligenceSection({ title, children }) {
  return (
    <section className="px-5 py-4 sm:px-6">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function TagList({ items }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-dim"
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function ConnectionList({ label, items, onOpenFile }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
        {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="mt-1 font-mono text-[11px] text-ink-mute">None</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((conn) => (
            <li key={conn.path}>
              <button
                type="button"
                onClick={() => onOpenFile(conn.path)}
                className="font-mono text-[11px] text-indigo hover:underline"
              >
                {conn.path}
              </button>
              {conn.items?.length ? (
                <span className="ml-1 font-mono text-[10px] text-ink-mute">
                  ({conn.items.join(", ")})
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function CodebaseExplorer({ branch = "main" }) {
  const [params, setParams] = useSearchParams();
  const dirPath = params.get("dir") ?? "";
  const selectedFile = params.get("file") ?? "";

  const { data: listing, loading } = useCodebaseDirectory(dirPath, branch);

  const panelTitle = useMemo(() => {
    if (selectedFile) return selectedFile.split("/").pop() ?? "File";
    return "File intelligence";
  }, [selectedFile]);

  function setDir(path) {
    const next = new URLSearchParams(params);
    if (path) next.set("dir", path);
    else next.delete("dir");
    next.delete("file");
    setParams(next, { replace: true });
  }

  function setFile(path) {
    const next = new URLSearchParams(params);
    next.set("file", path);
    const parent = path.split("/").slice(0, -1).join("/");
    if (parent) next.set("dir", parent);
    else next.delete("dir");
    setParams(next, { replace: true });
  }

  return (
    <Panel className="overflow-hidden">
      <div className="flex h-[min(72vh,640px)] min-h-[420px]">
        <div className="flex w-full max-w-sm shrink-0 flex-col border-r border-hairline">
          <PanelHeader
            kicker="Explorer"
            title="Directory tree"
            className="!px-4 !py-3"
          />
          <Breadcrumb path={dirPath} onNavigate={setDir} />
          <div className="flex-1 overflow-y-auto">
            <DirectoryTree
              listing={listing}
              loading={loading}
              selectedFile={selectedFile}
              onSelectDirectory={setDir}
              onSelectFile={setFile}
            />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <PanelHeader
            kicker="Intelligence"
            title={panelTitle}
            subtitle={selectedFile ? selectedFile : "No file selected"}
            className="!px-4 !py-3"
          />
          <div className="flex-1 overflow-y-auto">
            <FileIntelligencePanel
              filePath={selectedFile}
              branch={branch}
              onOpenFile={setFile}
            />
          </div>
        </div>
      </div>
    </Panel>
  );
}
