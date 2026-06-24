import { useState } from "react";
import { Link } from "react-router-dom";
import { AgentOxLogo } from "./AgentOxLogo";
import { BRAND, NAV_LINKS } from "../torusPageContent";

export default function TorusNav({ onToggleTheme, isLight }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="site-nav">
        <div className="nav-inner">
          <Link to="/" className="nav-brand">
            <AgentOxLogo size={44} className="logo-light" />
            <AgentOxLogo size={44} className="logo-dark" />
            {BRAND.name}
          </Link>
          <ul className="nav-links">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
          <Link to="/login" className="nav-signin">
            SIGN IN
          </Link>
          <button type="button" className="mode-toggle" onClick={onToggleTheme}>
            {isLight ? "DARK" : "LIGHT"}
          </button>
          <button
            type="button"
            className="nav-toggle"
            aria-label="Menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "×" : "☰"}
          </button>
        </div>
      </nav>
      <div className={`mobile-nav ${mobileOpen ? "open" : ""}`}>
        {NAV_LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            onClick={() => setMobileOpen(false)}
          >
            {link.label}
          </a>
        ))}
        <Link to="/login" onClick={() => setMobileOpen(false)}>
          SIGN IN
        </Link>
      </div>
    </>
  );
}
