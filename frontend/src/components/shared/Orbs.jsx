// Soft blurred colour orbs used as a background accent behind hero areas.
// Purely decorative: hidden from assistive tech, static with reduced motion.
// `variant` picks a layout preset from index.css (.orbs-hero, .orbs-cta, .orbs-panel).
export default function Orbs({ variant = "hero", className = "", ref }) {
  return (
    <div ref={ref} aria-hidden="true" className={`orbs orbs-${variant} ${className}`}>
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <span className="orb orb-d" />
    </div>
  );
}
