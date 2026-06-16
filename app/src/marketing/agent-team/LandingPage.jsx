import { useRef } from "react";
import { Link } from "react-router-dom";
import { CLIENT_LOGOS, CLIENT_METRICS, HERO } from "./constants";
import IntegrationMarquee from "./components/IntegrationMarquee";
import MarketingBackground from "./components/MarketingBackground";
import MarketingGridBackground from "./components/MarketingGridBackground";
import HeroLaptopStage from "./components/HeroLaptopStage";
import AgentChaptersSection from "./components/AgentChaptersSection";
import MarketingFooter from "./components/MarketingFooter";
import MarketingHeader from "./components/MarketingHeader";
import DashboardCostEstimator from "../../widgets/landing-dashboard/DashboardCostEstimator";
import { useLandingAnimations } from "./hooks/useLandingAnimations";
import "./agentTeam.css";

export default function LandingPage() {
  const rootRef = useRef(null);
  useLandingAnimations(rootRef);

  return (
    <div ref={rootRef} className="agent-team at-landing-root flex min-h-screen flex-col overflow-x-hidden">
      <MarketingGridBackground />
      <MarketingHeader />

      <section
        id="hero"
        data-hero
        className="at-pixel-bg-hero relative z-[1] min-h-[100dvh] w-full shrink-0 overflow-hidden [--hero-min-height:100dvh]"
      >
        <MarketingBackground />

        <div className="at-hero-layout relative z-10 mx-auto w-full max-w-[1440px] px-6 pb-16 pt-[max(7rem,18dvh)] sm:px-10 lg:px-12 lg:pb-20">
          <div className="at-hero-copy" data-hero-copy>
            <h1 className="at-hero-title at-hero-stagger m-0 max-w-[20ch] text-left font-normal leading-[1.12] tracking-[-0.01em]" style={{ "--stagger": 0 }}>
              {HERO.headline}
            </h1>
            <p
              className="at-hero-subhead at-hero-stagger mt-5 max-w-[42ch] text-left text-white/90"
              style={{ "--stagger": 1 }}
            >
              {HERO.subhead}
            </p>
            <div
              className="at-hero-stagger mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
              style={{ "--stagger": 2 }}
            >
              <Link
                to={HERO.ctaHref}
                state={{ mode: "signup" }}
                className="at-hero-primary-btn inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-5 py-2.5 text-[14px] font-semibold text-[#2B2D33] transition hover:bg-white/95"
              >
                {HERO.cta}
              </Link>
              <a
                href={HERO.secondaryHref}
                className="at-hero-secondary-btn inline-flex shrink-0 items-center justify-center rounded-lg px-5 py-2.5 text-[14px] font-medium text-white transition"
              >
                {HERO.secondaryCta}
              </a>
            </div>
          </div>
        </div>

        <HeroLaptopStage />
      </section>

      <main className="relative z-10 flex-1">
        <IntegrationMarquee />
        <AgentChaptersSection />

        <section id="pricing" data-pricing className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
                Pricing
              </p>
              <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33]">
                Estimate your monthly cost
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed text-[#6B6B6B]">
                Choose a plan and adjust the business scale slider to see how AgentOS pricing grows
                with your team.
              </p>
            </div>
            <DashboardCostEstimator variant="marketing" />
          </div>
        </section>

        <section id="clients" data-clients className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33]">
              Trusted by product teams running the full pipeline
            </h2>
            <div className="at-marquee mt-10 overflow-hidden">
              <div className="at-marquee-track flex w-max gap-12">
                {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="shrink-0 text-lg font-semibold text-[#6B6B6B]/40 transition hover:text-[#2B2D33]"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-3">
              {CLIENT_METRICS.map((m) => (
                <div key={m.label} data-client-metric className="at-card p-6 text-center">
                  <p className="at-metric text-[#2B2D33]">{m.value}</p>
                  <p className="mt-1 text-[14px] text-[#6B6B6B]">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-24 sm:px-8" data-final-cta>
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-bold text-[#2B2D33]">
              Create your account. Connect Jira. Ship.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-[#6B6B6B]">
              Sign in or create a free workspace — Virin, Ananta, and Neel are ready for your first
              ticket.
            </p>
            <Link
              to="/login"
              state={{ mode: "signup" }}
              className="at-btn-charcoal mt-8 inline-flex px-8 py-4 text-[15px] font-semibold"
            >
              Get Started
            </Link>
          </div>
        </section>
      </main>

      <div className="relative z-30 mt-auto shrink-0">
        <MarketingFooter />
      </div>
    </div>
  );
}
