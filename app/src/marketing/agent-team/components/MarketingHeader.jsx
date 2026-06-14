import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { NAV_LINKS } from "../constants";

function NavItem({ link, isActive, light }) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  const baseClass = light
    ? isActive
      ? "font-medium text-white"
      : "text-white/75 hover:text-white"
    : isActive
      ? "font-medium text-[#2B2D33]"
      : "text-[#6B6B6B] hover:text-[#2B2D33]";

  if (link.href.startsWith("/")) {
    return (
      <Link to={link.href} className={`relative text-[14px] transition-colors ${baseClass}`}>
        {link.label}
        {isActive && (
          <span
            className={`absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full ${
              light ? "bg-white" : "bg-[#A8C53A]"
            }`}
          />
        )}
      </Link>
    );
  }

  const href = isHome ? link.href : `/${link.href}`;
  return (
    <a href={href} className={`relative text-[14px] transition-colors ${baseClass}`}>
      {link.label}
      {isActive && (
        <span
          className={`absolute -bottom-1.5 left-0 h-0.5 w-full rounded-full ${
            light ? "bg-white" : "bg-[#A8C53A]"
          }`}
        />
      )}
    </a>
  );
}

export default function MarketingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [onHero, setOnHero] = useState(true);
  const [active, setActive] = useState("");
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      setOnHero(window.scrollY < window.innerHeight * 0.55);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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

  const lightHeader = isHome && onHero && !scrolled;

  return (
    <header
      data-marketing-header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-black/[0.04] bg-[#F7F3EC]/90 py-3 shadow-sm backdrop-blur-xl"
          : "bg-transparent py-5 backdrop-blur-[2px]"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <span
            className={`flex size-9 items-center justify-center rounded-2xl font-bold transition-colors ${
              lightHeader ? "bg-white text-[#2B2D33]" : "bg-[#2B2D33] text-white"
            }`}
          >
            A
          </span>
          <span
            className={`font-[Poppins] text-lg font-semibold tracking-tight transition-colors ${
              lightHeader ? "text-white" : "text-[#2B2D33]"
            }`}
          >
            Agentos
          </span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => {
            const isActive =
              link.href.startsWith("#") && isHome
                ? active === link.href
                : location.pathname === link.href;
            return (
              <NavItem key={link.label} link={link} isActive={isActive} light={lightHeader} />
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={`hidden px-5 py-2.5 text-[13px] font-medium transition sm:inline-flex ${
              lightHeader
                ? "rounded-full text-white/85 hover:bg-white/10 hover:text-white"
                : "at-pill text-[#6B6B6B] hover:text-[#2B2D33]"
            }`}
          >
            Login
          </Link>
          <Link
            to="/login"
            state={{ mode: "signup" }}
            className={`px-5 py-2.5 text-[13px] font-semibold transition ${
              lightHeader
                ? "inline-flex rounded-full bg-white text-[#2B2D33] hover:bg-white/95"
                : "at-btn-charcoal"
            }`}
          >
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
