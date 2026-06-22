import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../constants";

const SECTION_LINKS = NAV_LINKS.filter((link) => link.href.startsWith("#"));
const ROUTE_LINKS = NAV_LINKS.filter((link) => link.href.startsWith("/"));

function GlassBox({ children, className = "" }) {
  return (
    <div className={`at-nav-glass-box ${className}`}>
      <span className="at-nav-glass-surface" aria-hidden />
      {children}
    </div>
  );
}

function NavLink({ link, isActive, light }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  const className = `at-nav-link-item ${isActive ? "at-nav-link-item-active" : ""} ${
    light ? "at-nav-link-item-light" : "at-nav-link-item-dark"
  }`;

  if (link.href.startsWith("/")) {
    return (
      <Link to={link.href} className={className}>
        {link.label}
      </Link>
    );
  }

  const href = isHome ? link.href : `/${link.href}`;
  return (
    <a href={href} className={className}>
      {link.label}
    </a>
  );
}

export default function MarketingHeader() {
  const [heroInView, setHeroInView] = useState(true);
  const [active, setActive] = useState("");
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    if (!isHome) {
      setHeroInView(false);
      return undefined;
    }

    const hero = document.getElementById("hero");
    if (!hero) return undefined;

    const updateHeroInView = () => {
      const rect = hero.getBoundingClientRect();
      setHeroInView(rect.bottom > 88);
    };

    updateHeroInView();
    window.addEventListener("scroll", updateHeroInView, { passive: true });
    window.addEventListener("resize", updateHeroInView);
    return () => {
      window.removeEventListener("scroll", updateHeroInView);
      window.removeEventListener("resize", updateHeroInView);
    };
  }, [isHome]);

  useEffect(() => {
    if (!isHome) return undefined;
    const sections = [
      { id: "hero", link: "" },
      { id: "agents", link: "#agents" },
      { id: "pricing", link: "#pricing" },
      { id: "clients", link: "#clients" },
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const match = sections.find((s) => s.id === visible.target.id);
          setActive(match?.link ?? "");
        }
      },
      { rootMargin: "-40% 0px -45% 0px", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [isHome]);

  const lightHeader = isHome && heroInView;

  return (
    <header
      data-marketing-header
      className={`at-marketing-header ${
        lightHeader ? "at-marketing-header-hero" : "at-marketing-header-solid"
      }`}
    >
      <div className="at-marketing-header-inner">
        <Link to="/" className="at-marketing-logo" aria-label="AgentOX home">
          <span className={`at-marketing-logo-mark ${lightHeader ? "at-marketing-logo-light" : ""}`}>
            A
          </span>
          <span className={`at-marketing-logo-text ${lightHeader ? "text-white" : "text-[#2B2D33]"}`}>
            AgentOX
          </span>
        </Link>

        <div className="at-marketing-header-actions">
          <nav className="hidden items-center gap-3 min-[1000px]:flex">
            <GlassBox className="at-nav-glass-box-group">
              {SECTION_LINKS.map((link) => (
                <NavLink
                  key={link.label}
                  link={link}
                  isActive={isHome && active === link.href}
                  light={lightHeader}
                />
              ))}
            </GlassBox>

            {ROUTE_LINKS.map((link) => (
              <GlassBox key={link.label} className="at-nav-glass-box-single">
                <NavLink
                  link={link}
                  isActive={location.pathname === link.href}
                  light={lightHeader}
                />
              </GlassBox>
            ))}

            <GlassBox className="at-nav-glass-box-login">
              <Link
                to="/login"
                className={`at-nav-link-item ${lightHeader ? "at-nav-link-item-light" : "at-nav-link-item-dark"}`}
              >
                Login
              </Link>
            </GlassBox>
          </nav>

          <Link
            to="/login"
            state={{ mode: "signup" }}
            className={`at-nav-cta-box ${lightHeader ? "at-nav-cta-box-light" : "at-nav-cta-box-dark"}`}
          >
            <span className="at-nav-cta-surface" aria-hidden />
            <span className="relative z-10">Get Started</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
