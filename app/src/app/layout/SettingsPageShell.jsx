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
          className="inline-flex text-[13px] font-medium text-indigo hover:underline"
        >
          {backLabel}
        </Link>
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
