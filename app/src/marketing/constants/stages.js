/** Scroll-driven pipeline stages: Product → Engineering (production) → QA */
export const PIPELINE_STAGES = [
  {
    id: "jira-intake",
    label: "Jira intake",
    shortLabel: "JIRA-1287",
    scrollStart: 0,
    scrollEnd: 0.12,
    pathT: 0,
  },
  {
    id: "product",
    label: "Product Agent",
    shortLabel: "PRD",
    scrollStart: 0.12,
    scrollEnd: 0.32,
    pathT: 0.25,
  },
  {
    id: "engineering",
    label: "Engineering Agent",
    shortLabel: "Build",
    scrollStart: 0.32,
    scrollEnd: 0.52,
    pathT: 0.5,
  },
  {
    id: "qa",
    label: "QA Agent",
    shortLabel: "Tests",
    scrollStart: 0.52,
    scrollEnd: 0.72,
    pathT: 0.75,
  },
  {
    id: "jira-sync",
    label: "Jira sync",
    shortLabel: "Writeback",
    scrollStart: 0.72,
    scrollEnd: 1,
    pathT: 1,
  },
];

export const VALIDATION_SCROLL = { start: 0.38, end: 0.48 };
