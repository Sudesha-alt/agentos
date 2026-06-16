import { Link } from "react-router-dom";
import { PageIntro } from "../../shared/ui/Panel";
import { TitleWithInfo } from "../../shared/ui/InfoTip";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

export function SettingsPageShell({
  embedded = false,
  backTo = "/app/settings/integrations",
  backLabel = "← Integrations",
  kicker,
  title,
  info,
  wide = true,
  className = "",
  children,
}) {
  if (embedded) {
    return (
      <div className={`space-y-6 ${className}`}>
        <Link
          to={backTo}
          className="inline-flex items-center gap-1 text-sm font-medium text-app-ink-dim transition hover:text-indigo"
        >
          {backLabel}
        </Link>
        {kicker || title ? (
          <div className="border-b border-app-border pb-6">
            {kicker ? <p className="text-xs font-semibold text-app-ink-dim">{kicker}</p> : null}
            {title ? (
              <h2 className="mt-1 flex items-center gap-2 text-sm font-semibold text-app-ink">
                <TitleWithInfo info={info}>{title}</TitleWithInfo>
              </h2>
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
        <PageIntro kicker={kicker} title={title} info={info} />
      ) : null}
      {children}
    </AnimatedAppPage>
  );
}