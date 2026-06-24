import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import TorusFooter from "../torus/components/TorusFooter";
import TorusNav from "../torus/components/TorusNav";
import { useTorusTheme } from "../torus/hooks/useTorusTheme";
import { BRAND } from "../torus/torusPageContent";
import "../torus/torusMarketing.css";

export default function ContactPage() {
  const rootRef = useRef(null);
  const { isLight, toggleTheme } = useTorusTheme(rootRef);
  const [sent, setSent] = useState(false);

  function onSubmit(e) {
    e.preventDefault();
    setSent(true);
  }

  return (
    <div ref={rootRef} className="torus-marketing min-h-screen">
      <TorusNav onToggleTheme={toggleTheme} isLight={isLight} />
      <main className="page" style={{ paddingTop: "120px", paddingBottom: "64px" }}>
        <p className="cta-label">CONTACT</p>
        <h1 className="mission-headline" style={{ maxWidth: "640px" }}>
          Talk to us about your pipeline.
        </h1>
        <p className="cta-description">
          Tell us about your Jira workflow and we&apos;ll show how Virin runs discovery, Ananta plans
          against your codebase, and Neel holds the QA gate before writeback.
        </p>

        <div className="email-layout" style={{ marginTop: "48px" }}>
          <form onSubmit={onSubmit} className="email-frame" style={{ borderColor: "var(--line)" }}>
            {sent ? (
              <div className="email-body-area" style={{ clipPath: "none" }}>
                Thanks — we&apos;ll be in touch within one business day.
              </div>
            ) : (
              <div className="email-body-area" style={{ clipPath: "none" }}>
                {[
                  { id: "name", label: "NAME", type: "text" },
                  { id: "email", label: "EMAIL", type: "email" },
                  { id: "company", label: "COMPANY", type: "text" },
                ].map((field) => (
                  <label key={field.id} style={{ display: "block", marginBottom: "20px" }}>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "10px",
                        letterSpacing: "2px",
                        color: "var(--text-faint)",
                      }}
                    >
                      {field.label}
                    </span>
                    <input
                      type={field.type}
                      required
                      style={{
                        display: "block",
                        width: "100%",
                        marginTop: "8px",
                        padding: "12px",
                        background: "var(--surface)",
                        border: "1px solid var(--line)",
                        color: "var(--text)",
                        fontFamily: "var(--font-body)",
                        fontSize: "14px",
                      }}
                    />
                  </label>
                ))}
                <label style={{ display: "block", marginBottom: "24px" }}>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "10px",
                      letterSpacing: "2px",
                      color: "var(--text-faint)",
                    }}
                  >
                    MESSAGE
                  </span>
                  <textarea
                    required
                    rows={5}
                    style={{
                      display: "block",
                      width: "100%",
                      marginTop: "8px",
                      padding: "12px",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      color: "var(--text)",
                      fontFamily: "var(--font-body)",
                      fontSize: "14px",
                      resize: "vertical",
                    }}
                  />
                </label>
                <button type="submit" className="btn btn-primary">
                  SEND MESSAGE
                </button>
              </div>
            )}
          </form>

          <div className="email-sidebar" style={{ background: "transparent", border: "none" }}>
            <div className="email-sidebar-card" style={{ border: "1px solid var(--line)" }}>
              <div className="email-sidebar-card-label">EMAIL</div>
              <h3>{BRAND.email}</h3>
              <p>We respond within one business day.</p>
            </div>
            <div className="email-sidebar-card" style={{ border: "1px solid var(--line)" }}>
              <div className="email-sidebar-card-label">EARLY ACCESS</div>
              <h3>Ready to run a pipeline?</h3>
              <p>
                <Link to="/login" state={{ mode: "signup" }} style={{ color: "var(--accent)" }}>
                  Request early access →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
      <TorusFooter />
    </div>
  );
}
