import { Link } from "react-router-dom";
import { PageIntro } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export function SettingsPageShell({
  embedded = false,
  backTo = "/app/settings/integrations",
  backLabel = "← Integrations",
  kicker,
  title,
  body,
  wide = true,
  className = "",
  children,
}) {
  if (embedded) {
    return (
      <div className={`space-y-5 ${className}`}>
        <Link
          to={backTo}
          className="inline-flex text-[13px] font-medium text-app-ink-dim transition hover:text-indigo"
        >
          {backLabel}
        </Link>
        {kicker || title ? (
          <div className="space-y-1">
            {kicker ? <p className="type-kicker">{kicker}</p> : null}
            {title ? (
              <h2 className="text-[clamp(1.35rem,2.5vw,1.75rem)] font-semibold text-app-ink">
                {title}
              </h2>
            ) : null}
            {body ? (
              <p className="max-w-2xl text-[14px] leading-relaxed text-app-ink-dim">{body}</p>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <AnimatedAppPage wide={wide} className={className}>
      {kicker || title ? (
        <PageIntro kicker={kicker} title={title} body={body} />
      ) : null}
      {children}
    </AnimatedAppPage>
  );
}
