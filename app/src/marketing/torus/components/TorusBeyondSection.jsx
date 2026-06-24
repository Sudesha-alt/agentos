import { SECTION_02 } from "../torusPageContent";

export default function TorusBeyondSection() {
  const { intro, points } = SECTION_02;

  return (
    <div className="section section-reveal" data-reveal>
      <div className="beyond-ai">
        <div className="beyond-ai-intro stagger-reveal" data-reveal>
          <p>
            {intro[0]}
            <br />
            {intro[1]}
          </p>
          <p>{intro[2]}</p>
        </div>
        <div className="beyond-ai-points stagger-reveal" data-reveal>
          {points.map((point) => (
            <div key={point.title} className="beyond-ai-point">
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
