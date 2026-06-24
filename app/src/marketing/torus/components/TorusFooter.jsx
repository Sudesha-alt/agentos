import { AgentOxLogo } from "./AgentOxLogo";
import { BRAND } from "../torusPageContent";

export default function TorusFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer" data-reveal>
      <div className="page">
        <div className="footer-inner">
          <div className="footer-left">
            <div className="footer-brand">
              <AgentOxLogo size={32} className="logo-light" />
              <AgentOxLogo size={32} className="logo-dark" />
              {BRAND.name}
            </div>
            <div className="footer-tagline">{BRAND.footerTagline}</div>
          </div>
          <div className="footer-right">
            <a href="/contact" className="footer-contact">
              Contact
            </a>
            <a href={`mailto:${BRAND.email}`} className="footer-contact">
              {BRAND.email}
            </a>
            <div className="footer-meta">&copy; {year} AgentOX</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
