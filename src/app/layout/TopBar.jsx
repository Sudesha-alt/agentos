import { Link, useLocation, useNavigate } from "react-router-dom";
import { APP_NAV, DATA_MODE } from "../../shared/config/app";
import { useReadiness } from "../../entities/system";
import { useAuth } from "../../shared/providers/useAuth";

export default function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useReadiness({ pollMs: 15000 });
  const { user, logout } = useAuth();

  const segmentLabels = Object.fromEntries(
    APP_NAV.map((item) => [item.to.split("/").at(-1) || "app", item.breadcrumb])
  );

  const segments = location.pathname
    .split("/")
    .filter(Boolean)
    .map((seg, i, arr) => ({
      seg,
      to: "/" + arr.slice(0, i + 1).join("/"),
    }));

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-hairline bg-canvas/85 px-5 backdrop-blur-md sm:px-8">
      <div className="flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-[0.18em] text-ink-mute">
        {segments.map((s, i) => (
          <span key={s.to} className="flex items-center gap-2">
            {i > 0 && <span className="text-ink-mute/50">/</span>}
            <Link to={s.to} className="hover:text-ink transition-colors">
              {segmentLabels[s.seg] ?? s.seg}
            </Link>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`hidden items-center gap-2 rounded-full border border-hairline bg-surface/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] sm:inline-flex ${
            DATA_MODE === "mock" ? "text-warning" : "text-success"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              DATA_MODE === "mock" ? "bg-warning" : "bg-success"
            }`}
          />
          {DATA_MODE === "mock" ? "Mock adapter" : "REST adapter"}
        </span>
        <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-mute lg:inline-flex">
          <span
            className={`size-1.5 rounded-full ${
              data?.status === "ready" || data?.status === "ok"
                ? "bg-success"
                : "bg-warning"
            }`}
          />
          {data?.status ?? "checking"}
        </span>
        {user ? (
          <span className="hidden items-center gap-2 rounded-full border border-hairline bg-surface/60 px-3 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim xl:inline-flex">
            <span className="size-1.5 rounded-full bg-indigo" />
            {user.email}
          </span>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-hairline bg-surface/40 px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim transition-colors hover:text-ink"
        >
          Log out
        </button>
        <Link
          to="/"
          className="font-mono text-[11.5px] text-ink-mute hover:text-ink transition-colors"
        >
          ← marketing
        </Link>
      </div>
    </header>
  );
}
