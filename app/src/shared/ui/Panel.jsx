import InfoTip, { TitleWithInfo } from "./InfoTip";

const PANEL_STYLES = {
  light: {
    panel: "rounded-app border border-app-border bg-app-surface shadow-app-card transition-[box-shadow,border-color] duration-300 ease-out",
    headerBorder: "border-app-border",
    kicker: "type-kicker",
    title: "type-section-title",
    subtitle: "type-body",
    pageBorder: "border-app-border/80",
  },
  dark: {
    panel: "editorial-panel rounded-[1.25rem] border border-hairline/90 bg-surface/50",
    headerBorder: "border-hairline",
    kicker: "editorial-kicker text-ink-mute",
    title: "font-display text-[1.45rem] leading-none tracking-tight text-ink sm:text-[1.65rem]",
    subtitle: "text-ink-dim",
    pageBorder: "border-hairline/70",
  },
};

export function Panel({ children, className = "", variant = "light" }) {
  const styles = PANEL_STYLES[variant] ?? PANEL_STYLES.light;
  return <section className={`${styles.panel} ${className}`}>{children}</section>;
}

export function PanelHeader({
  kicker,
  title,
  info,
  subtitle,
  right,
  className = "",
  variant = "light",
}) {
  const styles = PANEL_STYLES[variant] ?? PANEL_STYLES.light;
  return (
    <header
      className={`border-b ${styles.headerBorder} px-5 py-4 sm:px-6 sm:py-5 ${className}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
          <h2
            className={
              variant === "light" ? `mt-1 ${styles.title}` : `mt-2 flex items-center gap-2 ${styles.title}`
            }
          >
            {info ? <TitleWithInfo info={info}>{title}</TitleWithInfo> : title}
          </h2>
          {subtitle ? (
            <p className={`mt-1.5 max-w-2xl ${styles.subtitle}`}>{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function PageIntro({ kicker, title, info, right, className = "", variant = "light" }) {
  const styles = PANEL_STYLES[variant] ?? PANEL_STYLES.light;
  return (
    <header
      className={`grid gap-3 pb-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end ${className}`}
    >
      <div>
        {kicker ? <p className={styles.kicker}>{kicker}</p> : null}
        <h1
          className={
            variant === "light"
              ? `mt-1.5 flex items-center gap-2 type-page-title`
              : "mt-3 flex max-w-4xl items-center gap-2 font-display text-[2.4rem] leading-[0.94] tracking-[-0.035em] text-ink sm:text-[3.4rem]"
          }
        >
          {info ? <TitleWithInfo info={info}>{title}</TitleWithInfo> : title}
        </h1>
      </div>
      {right ? <div className="sm:justify-self-end">{right}</div> : null}
    </header>
  );
}

export { InfoTip, TitleWithInfo };
