import { DATA_MODE } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { authHeaders } from "../../shared/lib/authHeaders";
import { useResource } from "../../shared/lib/useResource";

const MOCK_BOARD = {
  id: "mock-roadmap",
  title: "How to build a company",
  stages: [
    {
      id: "s-idea",
      key: "idea",
      label: "Idea stage",
      sortOrder: 0,
      completedCount: 1,
      totalCount: 1,
      items: [
        {
          id: "i1",
          slug: "initial-idea",
          stageId: "s-idea",
          stageKey: "idea",
          title: "Initial idea",
          description: null,
          routeType: "USER_INPUT",
          status: "COMPLETED",
          sortOrder: 0,
          dependsOnSlugs: [],
          jiraKey: null,
          availability: "completed",
          statusHint: "Done",
        },
      ],
    },
    {
      id: "s-initial",
      key: "initial",
      label: "Initial stage",
      sortOrder: 1,
      completedCount: 2,
      totalCount: 3,
      items: [
        {
          id: "i2",
          slug: "pick-name",
          stageId: "s-initial",
          stageKey: "initial",
          title: "Pick a company name",
          routeType: "USER_INPUT",
          status: "COMPLETED",
          sortOrder: 0,
          dependsOnSlugs: ["initial-idea"],
          jiraKey: null,
          availability: "completed",
          statusHint: "Done",
        },
        {
          id: "i3",
          slug: "prepare-repo",
          stageId: "s-initial",
          stageKey: "initial",
          title: "Prepare repository",
          routeType: "AGENT",
          status: "COMPLETED",
          sortOrder: 1,
          dependsOnSlugs: ["initial-idea"],
          jiraKey: null,
          availability: "completed",
          statusHint: "Done",
        },
        {
          id: "i4",
          slug: "incorporate",
          stageId: "s-initial",
          stageKey: "initial",
          title: "Incorporate LLC",
          routeType: "USER_INPUT",
          status: "PENDING",
          sortOrder: 2,
          dependsOnSlugs: ["initial-idea"],
          jiraKey: null,
          availability: "available",
          statusHint: "Needs your input",
        },
      ],
    },
  ],
};

function formatFetchError(err) {
  if (!(err instanceof Error)) return "Could not load roadmap.";
  const raw = err.message;
  if (raw.startsWith("API ")) {
    try {
      const json = raw.slice(raw.indexOf("{"));
      const body = JSON.parse(json);
      if (body.message) return body.message;
      if (body.error === "organization_required") {
        return "Complete workspace setup in onboarding before using the roadmap.";
      }
    } catch {
      /* use generic message */
    }
  }
  return "Could not load roadmap. Check that the server is running and migrations are applied.";
}

const restAdapter = {
  getBoard: async () => {
    try {
      return await fetchJson(apiPath("/api/roadmap/board"), { headers: authHeaders() });
    } catch (err) {
      throw new Error(formatFetchError(err));
    }
  },
  createItem: (body) =>
    fetchJson(apiPath("/api/roadmap/items"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }),
  updateItem: (itemId, body) =>
    fetchJson(apiPath(`/api/roadmap/items/${itemId}`), {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    }),
  deleteItem: (itemId) =>
    fetchJson(apiPath(`/api/roadmap/items/${itemId}`), {
      method: "DELETE",
      headers: authHeaders(),
    }),
};

const mockAdapter = {
  getBoard: async () => MOCK_BOARD,
  createItem: async () => MOCK_BOARD,
  updateItem: async () => MOCK_BOARD,
  deleteItem: async () => MOCK_BOARD,
};

export const roadmapAdapter = DATA_MODE === "rest" ? restAdapter : mockAdapter;

export function useRoadmapBoard(options = {}) {
  const result = useResource(() => roadmapAdapter.getBoard(), [], {
    pollMs: options.pollMs,
  });
  return { ...result, refresh: result.refetch };
}

export async function createRoadmapItem(body) {
  return roadmapAdapter.createItem(body);
}

export async function updateRoadmapItem(itemId, body) {
  return roadmapAdapter.updateItem(itemId, body);
}

export async function deleteRoadmapItem(itemId) {
  return roadmapAdapter.deleteItem(itemId);
}
