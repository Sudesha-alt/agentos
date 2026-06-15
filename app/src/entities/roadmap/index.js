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

const restAdapter = {
  getBoard: () =>
    fetchJson(apiPath("/api/roadmap/board"), { headers: authHeaders() }),
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
  return useResource(() => roadmapAdapter.getBoard(), [], {
    pollMs: options.pollMs,
  });
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
