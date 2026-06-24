import { lazy, Suspense, useRef } from "react";
import AgentChaptersSection from "../agent-team/components/AgentChaptersSection";
import IntegrationMarquee from "../agent-team/components/IntegrationMarquee";
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
} from "../agent-team/components/MarketingPageSections";
import { CLIENT_LOGOS, CLIENT_METRICS } from "../agent-team/constants";
import { PRICING } from "../agent-team/marketingPageContent";
import TorusAmbientRings from "./components/TorusAmbientRings";
import TorusBeyondSection from "./components/TorusBeyondSection";
import TorusConnector from "./components/TorusConnector";
import TorusFooter from "./components/TorusFooter";
import TorusHero from "./components/TorusHero";
import TorusMissionSection from "./components/TorusMissionSection";
import TorusNav from "./components/TorusNav";
import TorusPipelineMockup from "./components/TorusPipelineMockup";
import TorusWorkflowSection from "./components/TorusWorkflowSection";
import { useTorusReveal } from "./hooks/useTorusReveal";
import { useTorusTheme } from "./hooks/useTorusTheme";
import { SECTION_01, SECTION_02, SECTION_03, SECTION_04 } from "./torusPageContent";
import "./torusMarketing.css";
import "./torusLegacy.css";

const DashboardCostEstimator = lazy(
  () => import("../../widgets/landing-dashboard/DashboardCostEstimator")
);

function LegacyBlock({ children, reveal = false }) {
  return (
    <div
      className={`legacy-marketing ${reveal ? "section section-reveal" : ""}`}
      {...(reveal ? { "data-reveal": "" } : {})}
    >
      {children}
    </div>
  );
}

export default function TorusLandingPage() {
  const rootRef = useRef(null);
  useTorusReveal(rootRef);
  const { isLight, toggleTheme } = useTorusTheme(rootRef);

  return (
    <div ref={rootRef} className="torus-marketing">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <TorusNav onToggleTheme={toggleTheme} isLight={isLight} />
      <main id="main">
        <TorusAmbientRings />
        <div className="page">
          <div className="grid-patch grid-patch-hero revealed" aria-hidden="true" />
          <div className="grid-glow grid-glow-hero revealed" aria-hidden="true" />

          <TorusHero />

          <LegacyBlock>
            <IntegrationMarquee />
            <MarketingProblemSection />
            <MarketingSolutionSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_01.id} label={SECTION_01.label} first />
          <div className="section">
            <TorusPipelineMockup />
          </div>

          <LegacyBlock reveal>
            <AgentChaptersSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_02.id} label={SECTION_02.label} />
          <TorusBeyondSection />

          <LegacyBlock reveal>
            <MarketingDifferentiationSection />
            <MarketingIntelligenceSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_03.id} label={SECTION_03.label} />
          <TorusWorkflowSection />

          <LegacyBlock reveal>
            <MarketingHowItWorksSection />
          </LegacyBlock>

          <TorusConnector id={SECTION_04.id} label={SECTION_04.label} />
          <TorusMissionSection />

          <LegacyBlock reveal>
            <MarketingSocialProofSection
              clientLogos={CLIENT_LOGOS}
              clientMetrics={CLIENT_METRICS}
            />
            <MarketingRoiCalculator />
            <section id="pricing" data-pricing className="px-5 py-20 sm:px-8">
              <div className="mx-auto max-w-5xl">
                <div className="mb-10 text-center">
                  <p className="t-section-kicker">{PRICING.kicker}</p>
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
                  <Suspense fallback={<div className="at-card h-64 animate-pulse" />}>
                    <DashboardCostEstimator variant="marketing" />
                  </Suspense>
                </div>
              </div>
            </section>
            <MarketingFaqSection />
            <MarketingFinalCtaSection />
          </LegacyBlock>
        </div>
      </main>
      <TorusFooter />
    </div>
  );
}
