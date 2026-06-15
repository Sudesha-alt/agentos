import type { RoadmapRouteType } from "../generated/prisma/client";

export interface RoadmapTemplateStage {
  key: string;
  label: string;
  sortOrder: number;
}

export interface RoadmapTemplateItem {
  slug: string;
  stageKey: string;
  title: string;
  description?: string;
  routeType: RoadmapRouteType;
  sortOrder: number;
  dependsOnSlugs?: string[];
  /** Seed-only: mark complete for demo progress */
  seedCompleted?: boolean;
}

export const DEFAULT_ROADMAP_STAGES: RoadmapTemplateStage[] = [
  { key: "idea", label: "Idea stage", sortOrder: 0 },
  { key: "initial", label: "Initial stage", sortOrder: 1 },
  { key: "identity", label: "Identity stage", sortOrder: 2 },
  { key: "build", label: "Build stage", sortOrder: 3 },
  { key: "gtm", label: "GTM stage", sortOrder: 4 },
];

export const DEFAULT_ROADMAP_ITEMS: RoadmapTemplateItem[] = [
  {
    slug: "initial-idea",
    stageKey: "idea",
    title: "Initial idea",
    description: "Capture the core problem and who you are building for.",
    routeType: "USER_INPUT",
    sortOrder: 0,
    seedCompleted: true,
  },
  {
    slug: "pick-name",
    stageKey: "initial",
    title: "Pick a company name",
    routeType: "USER_INPUT",
    sortOrder: 0,
    dependsOnSlugs: ["initial-idea"],
    seedCompleted: true,
  },
  {
    slug: "prepare-repo",
    stageKey: "initial",
    title: "Prepare repository",
    routeType: "AGENT",
    sortOrder: 1,
    dependsOnSlugs: ["initial-idea"],
    seedCompleted: true,
  },
  {
    slug: "incorporate",
    stageKey: "initial",
    title: "Incorporate LLC",
    routeType: "USER_INPUT",
    sortOrder: 2,
    dependsOnSlugs: ["initial-idea"],
  },
  {
    slug: "brand-identity",
    stageKey: "identity",
    title: "Brand identity",
    routeType: "AGENT",
    sortOrder: 0,
    dependsOnSlugs: ["pick-name"],
  },
  {
    slug: "buy-domain",
    stageKey: "identity",
    title: "Buy domain",
    routeType: "USER_INPUT",
    sortOrder: 1,
    dependsOnSlugs: ["pick-name"],
  },
  {
    slug: "open-bank",
    stageKey: "identity",
    title: "Open bank account",
    routeType: "USER_INPUT",
    sortOrder: 2,
    dependsOnSlugs: ["incorporate"],
  },
  {
    slug: "social-presence",
    stageKey: "identity",
    title: "Setup social presence",
    routeType: "AGENT",
    sortOrder: 3,
    dependsOnSlugs: ["brand-identity"],
  },
  {
    slug: "positioning",
    stageKey: "identity",
    title: "Define positioning",
    routeType: "USER_INPUT",
    sortOrder: 4,
    dependsOnSlugs: ["brand-identity", "buy-domain"],
  },
  {
    slug: "build-app",
    stageKey: "build",
    title: "Build app",
    routeType: "AGENT",
    sortOrder: 0,
    dependsOnSlugs: ["prepare-repo", "positioning"],
  },
  {
    slug: "marketing-site",
    stageKey: "build",
    title: "Build marketing website",
    routeType: "AGENT",
    sortOrder: 1,
    dependsOnSlugs: ["buy-domain", "brand-identity"],
  },
  {
    slug: "add-auth",
    stageKey: "build",
    title: "Add auth",
    routeType: "AGENT",
    sortOrder: 2,
    dependsOnSlugs: ["build-app"],
  },
  {
    slug: "transactional-email",
    stageKey: "build",
    title: "Set up transactional email",
    routeType: "AGENT",
    sortOrder: 3,
    dependsOnSlugs: ["build-app"],
  },
  {
    slug: "outbound-email",
    stageKey: "build",
    title: "Setup outbound email",
    routeType: "AGENT",
    sortOrder: 4,
    dependsOnSlugs: ["positioning"],
  },
  {
    slug: "connect-social",
    stageKey: "build",
    title: "Connect social accounts",
    routeType: "USER_INPUT",
    sortOrder: 5,
    dependsOnSlugs: ["social-presence", "marketing-site"],
  },
  {
    slug: "bookkeeping",
    stageKey: "build",
    title: "Setup bookkeeping",
    routeType: "USER_INPUT",
    sortOrder: 6,
    dependsOnSlugs: ["open-bank"],
  },
  {
    slug: "gather-prospects",
    stageKey: "build",
    title: "Gather prospects",
    routeType: "USER_INPUT",
    sortOrder: 7,
    dependsOnSlugs: ["outbound-email"],
  },
  {
    slug: "blog-posts",
    stageKey: "gtm",
    title: "Write blog posts",
    routeType: "AGENT",
    sortOrder: 0,
    dependsOnSlugs: ["marketing-site", "positioning"],
  },
  {
    slug: "grow-social",
    stageKey: "gtm",
    title: "Grow social presence",
    routeType: "AGENT",
    sortOrder: 1,
    dependsOnSlugs: ["social-presence", "blog-posts"],
  },
  {
    slug: "launch-campaign",
    stageKey: "gtm",
    title: "Launch campaign",
    routeType: "APPROVAL",
    sortOrder: 2,
    dependsOnSlugs: ["gather-prospects", "marketing-site"],
  },
  {
    slug: "measure-traction",
    stageKey: "gtm",
    title: "Measure traction",
    routeType: "USER_INPUT",
    sortOrder: 3,
    dependsOnSlugs: ["launch-campaign"],
  },
];
