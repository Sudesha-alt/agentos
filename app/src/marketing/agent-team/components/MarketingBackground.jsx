/**
 * Cinematic office sunset — hero background with gradient overlay for copy.
 */
const HERO_IMAGE = "/marketing/beautiful-office-space-cartoon-style.jpg";

export default function MarketingBackground() {
  return (
    <div
      className="at-hero-scene pointer-events-none absolute inset-x-0 top-0 h-full min-h-[inherit] overflow-hidden"
      aria-hidden
    >
      <div className="at-hero-img-overlay absolute inset-0 z-[1]" />
      <img
        alt=""
        src={HERO_IMAGE}
        decoding="async"
        fetchPriority="high"
        loading="eager"
        className="at-hero-mountain-img absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div className="at-hero-mountain-fade" aria-hidden />
    </div>
  );
}
