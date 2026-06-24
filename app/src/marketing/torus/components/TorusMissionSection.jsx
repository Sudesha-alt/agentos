import { SECTION_04 } from "../torusPageContent";

export default function TorusMissionSection() {
  const { headline, body } = SECTION_04;

  return (
    <div className="section section-reveal mission-wrap" data-reveal>
      <div className="grid-patch grid-patch-steps" data-reveal />
      <div className="grid-glow grid-glow-steps" data-reveal aria-hidden="true" />
      <div className="mission">
        <p className="mission-headline">{headline}</p>
        <div className="mission-body stagger-reveal" data-reveal>
          {body.map((para, i) => {
            if (typeof para === "string") {
              return <p key={i}>{para}</p>;
            }
            return (
              <p key={i}>
                <strong>{para.strong}</strong>
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
