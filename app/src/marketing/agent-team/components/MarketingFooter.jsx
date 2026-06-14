import { Link } from "react-router-dom";
import { AGENTS } from "../constants";

export default function MarketingFooter() {
  return (
    <footer className="at-page-footer relative w-full bg-[#2B2D33] text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:grid-cols-2 lg:grid-cols-4 sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-2xl bg-white/10 font-bold">
              A
            </span>
            <span className="font-[Poppins] text-lg font-semibold">Agentos</span>
          </div>
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-white/60">
            From Jira intake to PRD, implementation, and QA gates — Virin, Ananta, and Neel run your
            pipeline end to end.
          </p>
          <div className="mt-6 flex gap-3">
            {["in", "x", "gh"].map((s) => (
              <span
                key={s}
                className="flex size-10 items-center justify-center rounded-full border border-white/15 text-xs uppercase text-white/50"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Agents</p>
          <ul className="mt-4 space-y-2 text-[14px] text-white/70">
            {AGENTS.map((agent) => (
              <li key={agent.id}>
                <a href="/#agents" className="hover:text-white">
                  {agent.name} · {agent.role}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Company</p>
          <ul className="mt-4 space-y-2 text-[14px] text-white/70">
            <li>
              <a href="/#clients" className="hover:text-white">
                Clients
              </a>
            </li>
            <li>
              <Link to="/contact" className="hover:text-white">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/login" className="hover:text-white">
                Login
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Get started
          </p>
          <p className="mt-4 text-[14px] text-white/60">
            Connect your backlog and let the team take the first ticket.
          </p>
          <Link
            to="/login"
            state={{ mode: "signup" }}
            className="mt-4 inline-flex rounded-full bg-gradient-to-r from-[#A8C53A] to-[#8FB52E] px-5 py-2.5 text-[13px] font-semibold text-[#2B2D33]"
          >
            Get Started
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3">
            {AGENTS.map((agent) => (
              <img
                key={agent.id}
                src={agent.image}
                alt={agent.name}
                className="size-10 rounded-full border border-white/15 bg-white/5 object-contain object-bottom p-0.5"
                draggable={false}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-white/45">
            <span>© {new Date().getFullYear()} Agentos</span>
            <a href="#" className="hover:text-white/70">
              Privacy
            </a>
            <a href="#" className="hover:text-white/70">
              Terms
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
