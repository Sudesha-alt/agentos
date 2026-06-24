import { Link } from "react-router-dom";
import { AgentOxLogo } from "./AgentOxLogo";
import { BRAND, HERO } from "../torusPageContent";

export default function TorusHero() {
  return (
    <section className="hero">
      <AgentOxLogo size={400} className="hero-torus logo-light" />
      <AgentOxLogo size={400} className="hero-torus logo-dark" />
      <div className="hero-brand">
        <h1 className="wordmark">{BRAND.name}</h1>
        <div className="wordmark-sub">
          <div className="wordmark-sub-line" />
          {BRAND.tagline}
        </div>
      </div>
      <div className="hero-pitch">
        <p className="hero-headline">{HERO.headline}</p>
        <p className="hero-description">{HERO.description}</p>
      </div>
      <div className="hero-cta">
        <Link to={HERO.primaryHref} state={{ mode: "signup" }} className="btn btn-primary">
          {HERO.primaryCta}
        </Link>
        <a href={HERO.secondaryHref} className="btn btn-secondary">
          {HERO.secondaryCta}
        </a>
      </div>
      <span className="cta-fallback">
        {HERO.fallback}{" "}
        <a href={`mailto:${BRAND.email}`}>{BRAND.email}</a>
      </span>
    </section>
  );
}
