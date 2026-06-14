/**
 * Cofounder-style hero background — mirrors cofounder.co source:
 * full-bleed pixel art image, right-aligned object-cover, aspect-ratio width.
 */
export default function MarketingBackground() {
  return (
    <div
      className="at-hero-scene pointer-events-none absolute inset-x-0 top-0 h-full min-h-[inherit] overflow-hidden"
      aria-hidden
    >
      <div className="at-hero-img-overlay absolute inset-0 z-[1]" />
      <img
        alt=""
        src="/marketing/agentos-hero-pixel.gif"
        width={3900}
        height={2280}
        decoding="async"
        fetchPriority="high"
        loading="eager"
        className="at-hero-pixel-img absolute bottom-0 right-0 z-0 h-full max-w-none object-cover object-right-bottom"
      />
    </div>
  );
}
