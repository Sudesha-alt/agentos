import { useState } from "react";
import { AgentOxLogo } from "./AgentOxLogo";
import { SECTION_01 } from "../torusPageContent";

export default function TorusPipelineMockup() {
  const [role, setRole] = useState("product");
  const { mockup, intro } = SECTION_01;

  const toggleRole = () => {
    setRole((r) => (r === "product" ? "engineering" : "product"));
  };

  return (
    <>
      <p className="dashboard-intro" data-reveal>
        {intro}
      </p>
      <div className="mockup-wrap">
        <div className="mockup-frame" data-reveal>
          <div className="mockup-titleblock">
            <div className="titleblock-brand">
              <AgentOxLogo size={16} className="logo-light" />
              <AgentOxLogo size={16} className="logo-dark" />
              AGENTOX
            </div>
            <div
              className={`titleblock-nav role-content ${role === "product" ? "active" : ""}`}
              data-view="product"
            >
              {mockup.productNav.map((item, i) => (
                <div
                  key={item}
                  className={`titleblock-nav-item ${i === 1 ? "active" : ""}`}
                >
                  {item}
                </div>
              ))}
            </div>
            <div
              className={`titleblock-nav role-content ${role === "engineering" ? "active" : ""}`}
              data-view="engineering"
            >
              {mockup.engNav.map((item, i) => (
                <div
                  key={item}
                  className={`titleblock-nav-item ${i === 0 ? "active" : ""}`}
                >
                  {item}
                </div>
              ))}
            </div>
            <button
              type="button"
              className="role-switch"
              onClick={toggleRole}
              aria-label="Switch view"
            >
              <span className={`role-switch-label ${role === "product" ? "active" : ""}`}>
                PRODUCT
              </span>
              <span className={`role-switch-label ${role === "engineering" ? "active" : ""}`}>
                ENGINEERING
              </span>
              <span className="role-switch-icon">⇄</span>
            </button>
          </div>

          <div className="mockup-content">
            <div
              className={`mockup-sidebar role-content ${role === "product" ? "active" : ""}`}
              data-view="product"
            >
              <div className="sidebar-group">
                <div className="sidebar-group-label">CONTEXT</div>
                {mockup.productSidebar.live.map((row, i) => (
                  <div key={row} className={`sidebar-row ${i === 0 ? "active" : ""}`}>
                    <span className="dot dot-live" />
                    {row}
                  </div>
                ))}
              </div>
              <div className="sidebar-group">
                <div className="sidebar-group-label">MISSING</div>
                {mockup.productSidebar.missing.map((row) => (
                  <div key={row} className="sidebar-row">
                    <span className="dot dot-ready" />
                    {row}
                  </div>
                ))}
              </div>
              <div className="sidebar-group">
                <div className="sidebar-group-label">{mockup.productSidebar.stat}</div>
              </div>
            </div>

            <div
              className={`mockup-sidebar role-content ${role === "engineering" ? "active" : ""}`}
              data-view="engineering"
            >
              <div className="sidebar-group">
                <div className="sidebar-group-label">LIVE</div>
                {mockup.engSidebar.live.map((row, i) => (
                  <div key={row} className={`sidebar-row ${i === 0 ? "active" : ""}`}>
                    <span className="dot dot-live" />
                    {row}
                  </div>
                ))}
              </div>
              <div className="sidebar-group">
                <div className="sidebar-group-label">LEARNING</div>
                {mockup.engSidebar.learning.map((row) => (
                  <div key={row} className="sidebar-row">
                    <span className="dot dot-learning" />
                    {row}
                  </div>
                ))}
              </div>
              <div className="sidebar-group">
                <div className="sidebar-group-label">READY</div>
                {mockup.engSidebar.ready.map((row) => (
                  <div key={row} className="sidebar-row">
                    <span className="dot dot-ready" />
                    {row}
                  </div>
                ))}
              </div>
            </div>

            <div
              className={`mockup-main role-content ${role === "product" ? "active" : ""}`}
              data-view="product"
            >
              <div className="main-topbar">
                <div>
                  <div className="main-title">{mockup.projectTitle}</div>
                  <div className="main-meta-row">
                    <span>
                      <span className="meta-accent">GAPS:</span> {mockup.productMeta.flags}
                    </span>
                    <span>
                      <span className="meta-accent">PRD:</span> {mockup.productMeta.coverage}
                    </span>
                  </div>
                </div>
              </div>
              <div className="agent-block">
                <div className="agent-block-header">
                  <span>PRD VALIDATION FLAGS</span>
                  <div className="agent-block-status">
                    <span className="dot dot-live" />2 OPEN
                  </div>
                </div>
                <div className="agent-block-body">
                  {mockup.productFlags.map((flag) => (
                    <div key={flag.lines[2]}>
                      <span className="accent">{flag.icon}</span> {flag.lines[0]}
                      <br />
                      &nbsp;&nbsp;{flag.lines[1]}
                      <br />
                      <span className="flag-rule">{flag.lines[2]}</span>
                      <br />
                      <br />
                    </div>
                  ))}
                </div>
                <div className="agent-block-actions">
                  <span>VIEW PRD</span>
                  <span>DISMISS</span>
                  <span className="action-accent">FIX GAPS</span>
                </div>
              </div>
            </div>

            <div
              className={`mockup-main role-content ${role === "engineering" ? "active" : ""}`}
              data-view="engineering"
            >
              <div className="main-topbar">
                <div>
                  <div className="main-title">{mockup.engBlock.title}</div>
                  <div className="main-meta-row">
                    {mockup.engBlock.meta.map((m) => (
                      <span key={m}>{m.includes(":") ? (
                        <>
                          <span className="meta-accent">{m.split(":")[0]}:</span>
                          {m.slice(m.indexOf(":") + 1)}
                        </>
                      ) : m}</span>
                    ))}
                  </div>
                </div>
                <span className="btn btn-primary btn-sm">APPROVE &amp; ROUTE</span>
              </div>
              <div className="agent-block">
                <div className="agent-block-header">
                  <span>IMPLEMENTATION SUMMARY</span>
                </div>
                <div className="agent-block-body">
                  {mockup.engBlock.body.map((line) => {
                    const [label, ...rest] = line.split(": ");
                    return (
                      <div key={line}>
                        <span className="accent">{label}:</span>{" "}
                        <span className="hl">{rest.join(": ")}</span>
                        <br />
                      </div>
                    );
                  })}
                </div>
                <div className="agent-block-actions">
                  <span>VIEW PLAN</span>
                  <span>EDIT</span>
                  <span className="action-accent">OPEN PR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
