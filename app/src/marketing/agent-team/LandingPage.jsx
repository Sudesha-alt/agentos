import { lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";
import { CLIENT_LOGOS, CLIENT_METRICS, HERO } from "./constants";
import IntegrationMarquee from "./components/IntegrationMarquee";
import MarketingBackground from "./components/MarketingBackground";
import MarketingGridBackground from "./components/MarketingGridBackground";
import AgentChaptersSection from "./components/AgentChaptersSection";
import MarketingFooter from "./components/MarketingFooter";
import MarketingHeader from "./components/MarketingHeader";
import {
  MarketingDifferentiationSection,
  MarketingFaqSection,
  MarketingFinalCtaSection,
  MarketingHowItWorksSection,
  MarketingIntelligenceSection,
  MarketingPricingTableSection,
  MarketingProblemSection,
  MarketingRoiCalculator,
  MarketingSocialProofSection,
  MarketingSolutionSection,
} from "./components/MarketingPageSections";
import { PRICING } from "./marketingPageContent";
import { useLandingAnimations } from "./hooks/useLandingAnimations";
import "./agentTeam.css";

const DashboardCostEstimator = lazy(
  () => import("../../widgets/landing-dashboard/DashboardCostEstimator")
);

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
            <h1
              className="at-hero-title at-hero-stagger m-0 max-w-[22ch] whitespace-pre-line text-left font-normal leading-[1.12] tracking-[-0.01em]"
              style={{ "--stagger": 0 }}
            >
              {HERO.headline}
            </h1>
            <p
              className="at-hero-subhead at-hero-stagger mt-5 max-w-[46ch] text-left text-white/90"
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
            <p
              className="at-hero-stagger mt-6 max-w-[48ch] text-left text-[13px] leading-relaxed text-white/75"
              style={{ "--stagger": 3 }}
            >
              {HERO.trustLine}
            </p>
            <p
              className="at-hero-stagger mt-4 text-left text-[12px] text-white/50"
              style={{ "--stagger": 4 }}
            >
              {HERO.socialProof}
            </p>
          </div>
        </div>
      </section>

      <main className="relative z-10 flex-1">
        <IntegrationMarquee />
        <MarketingProblemSection />
        <MarketingSolutionSection />
        <AgentChaptersSection />
        <MarketingDifferentiationSection />
        <MarketingIntelligenceSection />
        <MarketingHowItWorksSection />
        <MarketingSocialProofSection
          clientLogos={CLIENT_LOGOS}
          clientMetrics={CLIENT_METRICS}
        />
        <MarketingRoiCalculator />

        <section id="pricing" data-pricing className="px-5 py-20 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <p className="text-[12px] font-semibold uppercase tracking-widest text-[#6B6B6B]">
                {PRICING.kicker}
              </p>
              <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.5rem)] font-bold text-[#2B2D33]">
                {PRICING.headline}
              </h2>
            </div>
            <MarketingPricingTableSection />
            <p className="mt-8 text-center text-[13px] text-[#6B6B6B]">{PRICING.footnote}</p>
            <div className="mt-12">
              <p className="mb-6 text-center text-[14px] font-medium text-[#2B2D33]">
                Estimate your monthly cost
              </p>
              <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-[#F0ECE5]" />}>
                <DashboardCostEstimator variant="marketing" />
              </Suspense>
            </div>
          </div>
        </section>

        <MarketingFaqSection />
        <MarketingFinalCtaSection />
      </main>

      <div className="relative z-30 mt-auto shrink-0">
        <MarketingFooter />
      </div>
    </div>
  );
}
