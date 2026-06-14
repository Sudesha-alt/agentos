import { INTEGRATIONS } from "../constants";

export default function IntegrationMarquee() {
  const items = [...INTEGRATIONS, ...INTEGRATIONS];

  return (
    <section className="overflow-hidden border-y border-[#E8E4DE] bg-[#FAF7F0] py-10">
      <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
        Connected to every tool your team uses
      </p>
      <div className="at-marquee at-marquee-logos mt-8">
        <div className="at-marquee-logos-track flex w-max items-center gap-10 px-8">
          {items.map((tool, i) => (
            <div
              key={`${tool.id}-${i}`}
              className="at-logo-pill flex shrink-0 items-center justify-center"
              title={tool.detail}
            >
              <img
                src={tool.logo}
                alt={tool.name}
                className="at-integration-logo block w-auto max-w-none"
                style={{ height: tool.height ?? 28, minWidth: tool.minWidth ?? 80 }}
                loading="lazy"
                draggable={false}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
