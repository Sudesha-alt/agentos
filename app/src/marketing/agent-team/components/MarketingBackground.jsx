/**
 * Lo-fi pixel-art hero — animated GIF with gradient overlay for copy.
 */
export default function MarketingBackground() {
  return (
    <div
      className="at-hero-scene pointer-events-none absolute inset-x-0 top-0 h-full min-h-[inherit] overflow-hidden"
      aria-hidden
    >
      <div className="at-hero-img-overlay absolute inset-0 z-[1]" />
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcSet="/marketing/cool-hero-poster.png"
        />
        <img
          alt=""
          src="/marketing/cool.gif"
          width={3620}
          height={1930}
          decoding="async"
          fetchPriority="high"
          loading="eager"
          className="at-hero-pixel-img at-hero-pixel-img-cool absolute bottom-0 z-0 h-full max-w-none object-cover"
        />
      </picture>
      <div className="at-hero-pixel-ground" aria-hidden />
    </div>
  );
}
