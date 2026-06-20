import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchCompanyFromWeb,
  saveCompanyProfile,
} from "../entities/company-intelligence";
import {
  COMPANY_STAGES,
  TEAM_SIZES,
  USER_ROLES,
  completeOnboardingFlow,
  fetchOnboarding,
  saveOnboardingStep,
} from "../entities/onboarding";
import { useAuth } from "../shared/providers/useAuth";
import { sessionHomePath } from "../shared/routing/orgPaths";
import {
  createOrganization,
  fetchOrganizationsByDomain,
  joinOrganization,
} from "../entities/organization";
import "../marketing/agent-team/agentTeam.css";

const STEPS = ["welcome", "stage", "team", "role", "company", "organization"];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, organization, refresh, logout } = useAuth();
  const [stepIndex, setStepIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState(user?.name ?? "");
  const [companyStage, setCompanyStage] = useState(null);
  const [teamSize, setTeamSize] = useState(null);
  const [role, setRole] = useState(null);
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [productSummary, setProductSummary] = useState("");

  const [domainOrgs, setDomainOrgs] = useState([]);
  const [emailDomain, setEmailDomain] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [orgChoice, setOrgChoice] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null);

  async function redirectToLoginAfterAuthFailure() {
    await logout();
    navigate("/login", { replace: true, state: { from: "/onboarding" } });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { onboarding } = await fetchOnboarding();
        if (cancelled) return;
        if (onboarding?.completed && user?.organizationId) {
          navigate(sessionHomePath({ organization, user }), { replace: true });
          return;
        }
        if (onboarding?.completed && !user?.organizationId) {
          setStepIndex(STEPS.indexOf("organization"));
        }
        if (onboarding?.name) setName(onboarding.name);
        if (onboarding?.companyStage) setCompanyStage(onboarding.companyStage);
        if (onboarding?.teamSize) setTeamSize(onboarding.teamSize);
        if (onboarding?.role) setRole(onboarding.role);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "";
          if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
            void redirectToLoginAfterAuthFailure();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, user?.organizationId]);

  const step = STEPS[stepIndex];

  useEffect(() => {
    if (step !== "organization") return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchOrganizationsByDomain();
        if (cancelled) return;
        setEmailDomain(result.domain ?? "");
        setDomainOrgs(result.organizations ?? []);
        if (result.currentOrganizationId) {
          setOrgChoice("existing");
          setSelectedOrgId(result.currentOrganizationId);
        } else if ((result.organizations ?? []).length === 0) {
          setOrgChoice("create");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load workspaces");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step]);

  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const canContinue = useMemo(() => {
    if (step === "welcome") return name.trim().length >= 2;
    if (step === "stage") return Boolean(companyStage);
    if (step === "team") return Boolean(teamSize);
    if (step === "role") return Boolean(role);
    if (step === "company") return companyName.trim() && website.trim();
    if (step === "organization") {
      if (user?.organizationId) return true;
      if (orgChoice === "create") return newOrgName.trim().length >= 2;
      if (orgChoice === "join") return Boolean(selectedOrgId);
      return false;
    }
    return false;
  }, [step, name, companyStage, teamSize, role, companyName, website, orgChoice, selectedOrgId, newOrgName, user?.organizationId]);

  async function persistStep(patch) {
    await saveOnboardingStep(patch);
  }

  async function handleFetchWebsite() {
    if (!website.trim()) return;
    setPending(true);
    setError("");
    try {
      const result = await fetchCompanyFromWeb({
        website: website.trim(),
        companyName: companyName.trim() || undefined,
        profile: {},
      });
      const suggested = result?.suggested ?? result?.profile ?? result;
      if (suggested?.companyName && !companyName) setCompanyName(suggested.companyName);
      if (suggested?.productSummary) setProductSummary(suggested.productSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch website");
    } finally {
      setPending(false);
    }
  }

  async function handleNext() {
    setError("");
    setPending(true);
    try {
      if (step === "welcome") {
        await persistStep({ name: name.trim() });
        setStepIndex(1);
      } else if (step === "stage") {
        await persistStep({ companyStage });
        setStepIndex(2);
      } else if (step === "team") {
        await persistStep({ teamSize });
        setStepIndex(3);
      } else if (step === "role") {
        await persistStep({ role });
        setStepIndex(4);
      } else if (step === "company") {
        await persistStep({ name: name.trim() });
        setNewOrgName(companyName.trim());
        setStepIndex(5);
      } else if (step === "organization") {
        let orgSession = null;
        if (!user?.organizationId) {
          if (orgChoice === "join" && selectedOrgId) {
            orgSession = await joinOrganization(selectedOrgId);
          } else if (orgChoice === "create") {
            orgSession = await createOrganization(newOrgName.trim());
          } else {
            throw new Error("Choose a workspace to continue");
          }
          await refresh();
        }

        const stageLabel =
          COMPANY_STAGES.find((s) => s.id === companyStage)?.label ?? companyStage;
        const teamLabel = TEAM_SIZES.find((s) => s.id === teamSize)?.label ?? teamSize;
        const roleLabel = USER_ROLES.find((r) => r.id === role)?.label ?? role;

        await saveCompanyProfile({
          companyName: companyName.trim(),
          website: website.trim(),
          productSummary: productSummary.trim(),
          icp: "",
          revenueModel: "",
          pricingSummary: "",
          businessContext: [
            `Company stage: ${stageLabel}`,
            `Team size: ${teamLabel}`,
            `Primary contact role: ${roleLabel}`,
            productSummary.trim() ? `Product: ${productSummary.trim()}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
          strategicGoals: [],
          nonGoals: [],
          competitors: [],
        });
        await completeOnboardingFlow();
        const session = await refresh();
        navigate(sessionHomePath(orgSession ?? session ?? { organization, user }), { replace: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("401") || message.toLowerCase().includes("unauthorized") || message.toLowerCase().includes("session expired")) {
        setError("Your session expired. Please sign in again to continue setup.");
        setTimeout(() => {
          void redirectToLoginAfterAuthFailure();
        }, 1500);
      } else if (message.toLowerCase().includes("already belong")) {
        setError(message);
        await refresh();
      } else {
        setError(message);
      }
    } finally {
      setPending(false);
    }
  }

  function handleBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF7F0] text-sm text-[#6B6B6B]">
        Loading…
      </div>
    );
  }

  return (
    <div className="agent-team relative min-h-screen bg-[#FAF7F0] px-5 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40" aria-hidden>
        <div className="absolute left-[8%] top-[12%] h-48 w-64 rounded-[48px] bg-[#D9B8E8]/30 blur-3xl" />
        <div className="absolute right-[10%] bottom-[20%] h-56 w-72 rounded-[48px] bg-[#A8C53A]/20 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <p className="font-[Poppins] text-sm font-semibold text-[#2B2D33]">AgentOS</p>
          <p className="mt-1 text-xs text-[#6B6B6B]">Set up your workspace</p>
          <div className="mx-auto mt-6 h-1.5 max-w-xs overflow-hidden rounded-full bg-[#E8E4DE]">
            <div
              className="h-full rounded-full bg-[#2B2D33] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-[#6B6B6B]">
            Step {stepIndex + 1} of {STEPS.length}
          </p>
        </div>

        <div className="at-card p-8 sm:p-10">
          {step === "welcome" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">Welcome to AgentOS</h1>
              <p className="mt-2 text-[15px] text-[#6B6B6B]">
                A few questions so Virin, Ananta, and Neel understand your company before the
                first pipeline runs.
              </p>
              <label className="mt-8 block">
                <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                  Your name
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-[15px]"
                  placeholder="Alex Chen"
                />
              </label>
            </>
          ) : null}

          {step === "stage" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">
                What stage is your company at?
              </h1>
              <p className="mt-2 text-[15px] text-[#6B6B6B]">
                This shapes how aggressive agents are with scope and risk.
              </p>
              <OptionGrid
                options={COMPANY_STAGES}
                value={companyStage}
                onChange={setCompanyStage}
              />
            </>
          ) : null}

          {step === "team" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">
                How many people are at your company?
              </h1>
              <OptionGrid options={TEAM_SIZES} value={teamSize} onChange={setTeamSize} />
            </>
          ) : null}

          {step === "role" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">What is your role?</h1>
              <OptionGrid options={USER_ROLES} value={role} onChange={setRole} />
            </>
          ) : null}

          {step === "company" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">Tell us about your company</h1>
              <p className="mt-2 text-[15px] text-[#6B6B6B]">
                Virin uses this context for discovery, PRDs, and prioritization.
              </p>
              <div className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    Company name
                  </span>
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-[15px]"
                  />
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    Website
                  </span>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="https://"
                      className="min-w-0 flex-1 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-[15px]"
                    />
                    <button
                      type="button"
                      onClick={handleFetchWebsite}
                      disabled={pending || !website.trim()}
                      className="shrink-0 rounded-2xl border border-[#E8E4DE] px-4 py-3 text-sm font-medium disabled:opacity-50"
                    >
                      Fetch
                    </button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                    What does your product do?
                  </span>
                  <textarea
                    value={productSummary}
                    onChange={(e) => setProductSummary(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-[15px]"
                  />
                </label>
              </div>
            </>
          ) : null}

          {step === "organization" ? (
            <>
              <h1 className="text-2xl font-bold text-[#2B2D33]">Choose your workspace</h1>
              <p className="mt-2 text-[15px] text-[#6B6B6B]">
                Integrations, billing, and repos are scoped to the workspace you select.
                {emailDomain ? ` Others at @${emailDomain} may already have a team workspace.` : ""}
              </p>

              {user?.organizationId ? (
                <div className="mt-6 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-4">
                  <p className="font-medium text-[#2B2D33]">
                    {user.organizationName || "Your workspace"}
                  </p>
                  <p className="mt-1 text-sm text-[#6B6B6B]">
                    You are already assigned to this workspace. Continue to finish setup.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {domainOrgs.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                        Join an existing team
                      </p>
                      {domainOrgs.map((org) => {
                        const selected = orgChoice === "join" && selectedOrgId === org.id;
                        return (
                          <button
                            key={org.id}
                            type="button"
                            onClick={() => {
                              setOrgChoice("join");
                              setSelectedOrgId(org.id);
                            }}
                            className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                              selected
                                ? "border-[#2B2D33] bg-[#2B2D33] text-white"
                                : "border-[#E8E4DE] bg-white text-[#2B2D33] hover:border-[#2B2D33]/30"
                            }`}
                          >
                            <p className="font-medium">{org.companyName || org.name}</p>
                            <p className={`mt-1 text-sm ${selected ? "text-white/80" : "text-[#6B6B6B]"}`}>
                              {org.memberCount} member{org.memberCount === 1 ? "" : "s"} · @{org.domain}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={() => setOrgChoice("create")}
                      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                        orgChoice === "create"
                          ? "border-[#2B2D33] bg-[#2B2D33] text-white"
                          : "border-[#E8E4DE] bg-white text-[#2B2D33] hover:border-[#2B2D33]/30"
                      }`}
                    >
                      <p className="font-medium">Create a new workspace</p>
                      <p className={`mt-1 text-sm ${orgChoice === "create" ? "text-white/80" : "text-[#6B6B6B]"}`}>
                        Start fresh with your own org — integrations stay private to your team.
                      </p>
                    </button>
                    {orgChoice === "create" ? (
                      <label className="block">
                        <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                          Workspace name
                        </span>
                        <input
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3 text-[15px]"
                          placeholder="Acme Product Team"
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              )}
            </>
          ) : null}

          {error ? (
            <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={stepIndex === 0 || pending}
              className="rounded-2xl px-4 py-2.5 text-sm font-medium text-[#6B6B6B] disabled:opacity-40"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!canContinue || pending}
              className="at-btn-charcoal px-6 py-3 text-[15px] font-semibold disabled:opacity-50"
            >
              {pending
                ? "Please wait…"
                : step === "organization"
                  ? "Finish setup"
                  : step === "company"
                    ? "Continue"
                    : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function OptionGrid({ options, value, onChange }) {
  return (
    <div className="mt-6 grid gap-3">
      {options.map((opt) => {
        const selected = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`rounded-2xl border px-4 py-4 text-left transition ${
              selected
                ? "border-[#2B2D33] bg-[#2B2D33] text-white"
                : "border-[#E8E4DE] bg-white text-[#2B2D33] hover:border-[#2B2D33]/30"
            }`}
          >
            <p className="font-medium">{opt.label}</p>
            {opt.hint ? (
              <p className={`mt-1 text-sm ${selected ? "text-white/80" : "text-[#6B6B6B]"}`}>
                {opt.hint}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
