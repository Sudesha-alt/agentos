import { SECTION_03 } from "../torusPageContent";

export default function TorusWorkflowSection() {
  const { email, sidebar } = SECTION_03;

  return (
    <>
      <div className="grid-patch grid-patch-email" data-reveal />
      <div className="section section-reveal" data-reveal>
        <div className="email-layout">
          <div className="email-frame">
            <div className="email-bar">
              <div className="email-bar-label">FROM</div>
              <div className="email-bar-value">{email.from}</div>
            </div>
            <div className="email-bar">
              <div className="email-bar-label">TO</div>
              <div className="email-bar-value">{email.to}</div>
            </div>
            <div className="email-bar">
              <div className="email-bar-label">RE</div>
              <div className="email-bar-value email-subject">{email.subject}</div>
            </div>
            <div className="email-body-area">
              {email.body.map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
              <div className="email-torus-block">
                <div className="email-torus-header">{email.output.header}</div>
                <div className="email-torus-body">
                  {email.output.lines.map((row) => (
                    <span key={row.label}>
                      <span className="accent">{row.label}</span>{" "}
                      <span className={row.highlight ? "hl" : ""}>{row.value}</span>
                      <br />
                    </span>
                  ))}
                </div>
              </div>
              {email.closing}
              <br />
              <div className="email-sig">{email.sig}</div>
            </div>
          </div>
          <div className="email-sidebar stagger-reveal" data-reveal>
            {sidebar.map((card) => (
              <div key={card.label} className="email-sidebar-card">
                <div className="email-sidebar-card-label">{card.label}</div>
                <h3>{card.title}</h3>
                <p>{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
