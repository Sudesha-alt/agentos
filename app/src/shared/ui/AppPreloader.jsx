import "./AppPreloader.css";

export default function AppPreloader({
  label,
  overlay = false,
  exiting = false,
  tone = "default",
  size = "md",
  className = "",
}) {
  const loader = (
    <div
      className={[
        "app-preloader",
        tone === "indigo" ? "app-preloader--indigo" : "",
        size === "sm" ? "app-preloader--sm" : "",
        size === "lg" ? "app-preloader--lg" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-label={label || "Loading"}
    />
  );

  if (!overlay) {
    return (
      <div className="flex flex-col items-center justify-center gap-3">
        {loader}
        {label ? <p className="app-preloader-label">{label}</p> : null}
        <span className="sr-only">{label || "Loading…"}</span>
      </div>
    );
  }

  return (
    <div
      className={`app-preloader-overlay${exiting ? " app-preloader-overlay--exit" : ""}`}
      aria-live="polite"
      aria-busy={!exiting}
    >
      {loader}
      {label ? <p className="app-preloader-label">{label}</p> : null}
    </div>
  );
}
