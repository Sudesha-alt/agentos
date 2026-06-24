import { useRef } from "react";
import TorusAmbientRings from "./components/TorusAmbientRings";
import TorusBeyondSection from "./components/TorusBeyondSection";
import TorusConnector from "./components/TorusConnector";
import TorusCtaSection from "./components/TorusCtaSection";
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

          <TorusConnector id={SECTION_01.id} label={SECTION_01.label} first />
          <div className="section">
            <TorusPipelineMockup />
          </div>

          <TorusConnector id={SECTION_02.id} label={SECTION_02.label} />
          <TorusBeyondSection />

          <TorusConnector id={SECTION_03.id} label={SECTION_03.label} />
          <TorusWorkflowSection />

          <TorusConnector id={SECTION_04.id} label={SECTION_04.label} />
          <TorusMissionSection />

          <TorusCtaSection />
        </div>
      </main>
      <TorusFooter />
    </div>
  );
}
