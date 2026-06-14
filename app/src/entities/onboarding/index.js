import { OnboardingProfileSchema } from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { AUTH_SESSION_STORAGE_KEY } from "../auth";

const ONBOARDING_PREFIX = "agentos.onboarding.";

function readLocalOnboarding(userId) {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${ONBOARDING_PREFIX}${userId}`);
  if (!raw) return null;
  try {
    return OnboardingProfileSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeLocalOnboarding(profile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      `${ONBOARDING_PREFIX}${profile.userId}`,
      JSON.stringify(profile)
    );
  }
}

function authHeaders() {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return {};
  try {
    const session = JSON.parse(raw);
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
  } catch {
    return {};
  }
}

const mockAdapter = {
  async get() {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return { onboarding: null };
    const session = JSON.parse(raw);
    const record =
      readLocalOnboarding(session.user.id) ??
      OnboardingProfileSchema.parse({
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name,
        companyStage: null,
        teamSize: null,
        role: null,
        completed: session.user.email === "demo@agentos.ai",
        completedAt: session.user.email === "demo@agentos.ai" ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
    return { onboarding: record };
  },
  async update(patch) {
    const { onboarding } = await this.get();
    const updated = OnboardingProfileSchema.parse({
      ...onboarding,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
    writeLocalOnboarding(updated);
    return { onboarding: updated };
  },
  async complete() {
    const { onboarding } = await this.get();
    const updated = OnboardingProfileSchema.parse({
      ...onboarding,
      completed: true,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    writeLocalOnboarding(updated);
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      session.onboardingCompleted = true;
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
    return { onboarding: updated };
  },
};

const restAdapter = {
  async get() {
    return fetchJson(apiPath("/api/onboarding"), { headers: authHeaders() });
  },
  async update(patch) {
    return fetchJson(apiPath("/api/onboarding"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(patch),
    });
  },
  async complete() {
    const result = await fetchJson(apiPath("/api/onboarding/complete"), {
      method: "POST",
      headers: authHeaders(),
    });
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (raw) {
      const session = JSON.parse(raw);
      session.onboardingCompleted = true;
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    }
    return result;
  },
};

export const onboardingAdapter =
  DATA_MODE === "rest" ? restAdapter : mockAdapter;

export async function fetchOnboarding() {
  return onboardingAdapter.get();
}

export async function saveOnboardingStep(patch) {
  return onboardingAdapter.update(patch);
}

export async function completeOnboardingFlow() {
  return onboardingAdapter.complete();
}

export const COMPANY_STAGES = [
  { id: "idea", label: "Idea stage", hint: "Exploring a problem or early concept" },
  { id: "mvp", label: "MVP / early product", hint: "Shipping first versions to real users" },
  { id: "growth", label: "Growth", hint: "Scaling product and team" },
  { id: "scale", label: "Scale-up", hint: "Multiple teams, mature delivery" },
  { id: "enterprise", label: "Enterprise", hint: "Large org, compliance-heavy" },
];

export const TEAM_SIZES = [
  { id: "solo", label: "Just me" },
  { id: "2-10", label: "2–10 people" },
  { id: "11-50", label: "11–50 people" },
  { id: "51-200", label: "51–200 people" },
  { id: "200+", label: "200+ people" },
];

export const USER_ROLES = [
  { id: "founder", label: "Founder / CEO" },
  { id: "product", label: "Product / PM" },
  { id: "engineering", label: "Engineer" },
  { id: "engineering_lead", label: "Engineering lead" },
  { id: "ops", label: "Operations / RevOps" },
  { id: "other", label: "Other" },
];
