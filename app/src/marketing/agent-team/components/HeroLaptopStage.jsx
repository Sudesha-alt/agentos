import HeroTaskNotification from "./HeroTaskNotification";

/** Floating task pill anchored above the pixel-art laptop in the hero background. */
export default function HeroLaptopStage() {
  return (
    <div className="at-hero-laptop-notif-anchor" aria-hidden>
      <HeroTaskNotification />
    </div>
  );
}
