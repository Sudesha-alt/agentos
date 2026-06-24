import { Link } from "react-router-dom";
import { AgentOxLogo } from "./AgentOxLogo";
import { BRAND, FINAL_CTA } from "../torusPageContent";

export default function TorusCtaSection() {
  return (
    <div className="cta-section cta-wrap section-reveal" data-reveal>
      <div className="grid-patch grid-patch-cta" data-reveal />
      <div className="grid-glow grid-glow-cta" data-reveal aria-hidden="true" />
      <AgentOxLogo size={280} className="cta-logo logo-light" />
      <AgentOxLogo size={280} className="cta-logo logo-dark" />
      <p className="cta-label">{FINAL_CTA.label}</p>
      <h2>{FINAL_CTA.headline}</h2>
      <p className="cta-description">{FINAL_CTA.description}</p>
      <div className="cta-buttons">
        <Link to={FINAL_CTA.primaryHref} state={{ mode: "signup" }} className="btn btn-primary">
          {FINAL_CTA.primaryCta}
        </Link>
      </div>
      <span className="cta-fallback">
        {FINAL_CTA.fallback}{" "}
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
      </span>
    </div>
  );
}
