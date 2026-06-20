import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AGENT_CHAPTERS, AGENTS } from "../constants";

function ChapterCoverArt({ chapter }) {
  if (chapter.coverAgents?.length) {
    return (
      <div className="at-chapter-art at-chapter-art-pipeline">
        <div className="grid h-full w-full grid-cols-3 items-end justify-items-center gap-1 px-2 pb-1">
          {chapter.coverAgents.map((id) => {
            const meta = AGENTS.find((a) => a.id === id);
            if (!meta?.image) return <div key={id} className="size-16" />;
            return (
              <img
                key={id}
                src={meta.image}
                alt={meta.name}
                className="h-[88px] w-[68px] object-contain object-bottom"
                draggable={false}
                loading="lazy"
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (!chapter.image) {
    return <div className="at-chapter-art at-chapter-art-fallback" />;
  }

  return (
    <div className={`at-chapter-art at-chapter-art-${chapter.gradient}`}>
      <img
        src={chapter.image}
        alt={`${chapter.name} — ${chapter.role}`}
        className="h-[104px] w-full max-w-[140px] object-contain object-bottom"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}

function ChapterBook({ chapter, isActive, onSelect }) {
  return (
    <button
      type="button"
      data-agent-chapter={chapter.id}
      onClick={() => onSelect(chapter.id)}
      className={`at-chapter-book group shrink-0 text-left transition-transform duration-500 ease-out hover:-translate-y-1 ${
        isActive ? "at-chapter-book-active" : ""
      }`}
      aria-expanded={isActive}
      aria-controls={chapter.sectionId}
    >
      <div className="at-chapter-spine" aria-hidden />
      <div className="at-chapter-body">
        <div className="at-chapter-head">
          <h3 className="at-chapter-title">
            {`Chapter ${chapter.chapter}\n${chapter.chapterTitle}`}
          </h3>
        </div>
        <div className="at-chapter-rule" />
        <p className="at-chapter-roman">Chapter {chapter.chapterRoman}</p>
        <div className="at-chapter-art-wrap">
          <ChapterCoverArt chapter={chapter} />
        </div>
        <div className="at-chapter-foot">
          <span>by AgentOS</span>
          <span>2026</span>
        </div>
        <p className="at-chapter-cta">
          Read this chapter ({chapter.chapterRoman})
        </p>
      </div>
    </button>
  );
}

function ChapterDetail({ chapter, onClose }) {
  const teammate = AGENTS.find((a) => a.id === chapter.id);

  return (
    <div
      id={chapter.sectionId}
      data-agent-section={chapter.id}
      className="at-chapter-detail at-card overflow-hidden"
      role="region"
      aria-label={`Chapter ${chapter.chapter}: ${chapter.chapterTitle}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E4DE] bg-[#FAF7F0] px-5 py-4 sm:px-6">
        <div>
          <p className="at-chapter-roman !px-0 !pt-0">Chapter {chapter.chapterRoman}</p>
          <h3 className="mt-1 text-xl font-semibold text-[#2B2D33] sm:text-2xl">{chapter.chapterTitle}</h3>
          <p className="mt-0.5 text-sm text-[#6B6B6B]">
            {chapter.name}
            {chapter.role ? ` · ${chapter.role}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[#E8E4DE] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B6B] transition hover:border-[#2B2D33]/20 hover:text-[#2B2D33]"
        >
          Close
        </button>
      </div>

      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(140px,200px)_1fr] sm:p-6">
        <div className="flex shrink-0 justify-center sm:justify-start">
          {chapter.coverAgents ? (
            <div className="grid grid-cols-3 gap-2">
              {chapter.coverAgents.map((id) => {
                const meta = AGENTS.find((a) => a.id === id);
                if (!meta?.image) return <div key={id} />;
                return (
                  <img
                    key={id}
                    src={meta.image}
                    alt={meta.name}
                    className="h-24 w-20 object-contain object-bottom"
                    draggable={false}
                    loading="lazy"
                  />
                );
              })}
            </div>
          ) : teammate?.image ? (
            <img
              src={teammate.image}
              alt={teammate.name}
              className="h-36 w-32 object-contain object-bottom"
              draggable={false}
              loading="lazy"
            />
          ) : null}
        </div>

        <div data-agent-copy={chapter.id}>
          <p className="text-[15px] font-medium leading-relaxed text-[#2B2D33]">{chapter.teammateIntro}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-[#6B6B6B]">{chapter.body}</p>
          <ul className="mt-5 space-y-2.5">
            {chapter.bullets.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[14px] text-[#2B2D33]">
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#A8C53A]/25 text-[10px]">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            to={chapter.appPath}
            state={chapter.id === "pipeline" ? { mode: "signup" } : undefined}
            className="at-btn-charcoal mt-6 inline-flex px-6 py-3 text-[14px] font-semibold"
          >
            {chapter.id === "pipeline" ? "Get Started" : `Meet ${chapter.name}`}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AgentChaptersSection() {
  const [activeId, setActiveId] = useState(null);
  const detailRef = useRef(null);
  const activeChapter = AGENT_CHAPTERS.find((c) => c.id === activeId);

  const handleSelect = (id) => {
    setActiveId(id);
    requestAnimationFrame(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  return (
    <section id="agents" data-agents className="relative z-10 px-5 py-16 sm:px-8 sm:py-20">
      <div className="mx-auto w-full max-w-[1280px]">
        <div className="mb-12 text-center">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
            Meet the agents
          </p>
          <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.25rem)] font-bold text-[#2B2D33]">
            Learn how AgentOS runs your pipeline
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#6B6B6B]">
            Four chapters — Product, Engineering, QA, and the full loop. Click a book to read what
            each agent does.
          </p>
        </div>

        <div className="at-chapter-row">
          {AGENT_CHAPTERS.map((chapter) => (
            <ChapterBook
              key={chapter.id}
              chapter={chapter}
              isActive={activeId === chapter.id}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {activeChapter ? (
          <div ref={detailRef} className="mt-10">
            <ChapterDetail chapter={activeChapter} onClose={() => setActiveId(null)} />
          </div>
        ) : null}
      </div>
    </section>
  );
}
