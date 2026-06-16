import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  generateCodebaseKnowledge,
  useCodebaseKnowledge,
} from "../../entities/codebase";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

const SECTIONS = [
  { id: "architecture", label: "Architecture" },
  { id: "components", label: "Components" },
  { id: "runbooks", label: "Runbooks" },
];

function FileRefLink({ path, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(path)}
      className="font-mono text-[11px] text-indigo hover:underline"
    >
      {path}
    </button>
  );
}

function ArchitectureView({ doc, onOpenFile }) {
  return (
    <article className="space-y-6">
      <div>
        <h3 className="font-display text-xl text-ink">{doc.title}</h3>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-dim">{doc.purpose}</p>
      </div>
      {(doc.sections ?? []).map((section) => (
        <section key={section.heading}>
          <h4 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-mute">
            {section.heading}
          </h4>
          <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-dim">
            {section.body}
          </p>
          {section.fileRefs?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {section.fileRefs.map((ref) => (
                <FileRefLink key={ref} path={ref} onOpen={onOpenFile} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </article>
  );
}

function ComponentsView({ components, onOpenFile }) {
  if (!components?.length) {
    return <p className="text-[13px] text-ink-dim">No component guides yet.</p>;
  }

  return (
    <div className="space-y-6">
      {components.map((comp) => (
        <section
          key={comp.path}
          className="rounded-xl border border-hairline bg-surface/30 px-4 py-4"
        >
          <h3 className="font-display text-lg text-ink">{comp.title}</h3>
          <p className="mt-1 font-mono text-[11px] text-indigo">{comp.path}/</p>
          <p className="mt-2 text-[14px] text-ink-dim">{comp.summary}</p>
          {comp.responsibilities?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[13px] text-ink-dim">
              {comp.responsibilities.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {comp.keyFiles?.length ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                Key files
              </p>
              <ul className="mt-2 space-y-2">
                {comp.keyFiles.map((file) => (
                  <li key={file.path}>
                    <FileRefLink path={file.path} onOpen={onOpenFile} />
                    <p className="text-[12px] text-ink-mute">{file.summary}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

function RunbooksView({ runbooks, onOpenFile }) {
  if (!runbooks?.length) {
    return <p className="text-[13px] text-ink-dim">No runbooks yet.</p>;
  }

  return (
    <div className="space-y-6">
      {runbooks.map((book) => (
        <section
          key={book.task}
          className="rounded-xl border border-hairline bg-surface/30 px-4 py-4"
        >
          <h3 className="font-display text-lg text-ink">{book.title}</h3>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            {book.task}
          </p>
          <p className="mt-2 text-[14px] text-ink-dim">{book.summary}</p>
          <ol className="mt-4 space-y-2">
            {(book.steps ?? [])
              .sort((a, b) => a.order - b.order)
              .map((step) => (
                <li key={step.order} className="text-[13px] text-ink-dim">
                  <span className="font-mono text-indigo">{step.order}.</span> {step.instruction}
                  {step.fileRef ? (
                    <>
                      {" "}
                      <FileRefLink path={step.fileRef} onOpen={onOpenFile} />
                    </>
                  ) : null}
                </li>
              ))}
          </ol>
          {book.exampleFiles?.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {book.exampleFiles.map((path) => (
                <FileRefLink key={path} path={path} onOpen={onOpenFile} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export default function CodebaseKnowledgePanel({ branch = "main" }) {
  const { data, loading, error, refetch } = useCodebaseKnowledge({ branch });
  const [section, setSection] = useState("architecture");
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  function openInExplorer(filePath) {
    const parent = filePath.split("/").slice(0, -1).join("/");
    const next = new URLSearchParams(params);
    next.set("tab", "explorer");
    next.set("file", filePath);
    if (parent) next.set("dir", parent);
    else next.delete("dir");
    navigate(`/app/codebase?${next.toString()}`);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      await generateCodebaseKnowledge(branch);
      await refetch();
    } finally {
      setGenerating(false);
    }
  }

  if (loading && !data) {
    return (
      <Panel>
        <PanelHeader kicker="Knowledge" title="Loading documentation…" />
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </Panel>
    );
  }

  if (error && !data) {
    return (
      <Panel>
        <PanelHeader kicker="Knowledge" title="Unavailable" subtitle={error.message} />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Knowledge base"
        title="Living documentation"
        right={
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[12px] text-ink disabled:opacity-50"
          >
            {generating ? "Generating…" : "Regenerate"}
          </button>
        }
      />

      <div className="border-b border-hairline px-5 py-3 sm:px-6">
        <div className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={`rounded-full px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] ${
                section === s.id
                  ? "bg-indigo/15 text-ink"
                  : "text-ink-mute hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {data?.source ? (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
            {data.source === "openai" || data.source === "cache"
              ? "AI-generated"
              : "Heuristic"}{" "}
            · {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : ""}
          </p>
        ) : null}
      </div>

      <div className="px-5 py-6 sm:px-6">
        {section === "architecture" ? (
          <ArchitectureView doc={data?.architecture} onOpenFile={openInExplorer} />
        ) : null}
        {section === "components" ? (
          <ComponentsView components={data?.components} onOpenFile={openInExplorer} />
        ) : null}
        {section === "runbooks" ? (
          <RunbooksView runbooks={data?.runbooks} onOpenFile={openInExplorer} />
        ) : null}
      </div>
    </Panel>
  );
}
