import { useCallback, useEffect, useRef } from "react";

// Soft blurred colour orbs used as a background accent behind hero areas.
// They float on their own and, on devices with a fine pointer, drift toward
// the cursor at different depths. Decorative only: hidden from assistive
// tech, and completely still with prefers-reduced-motion.
// `variant` picks a layout preset from index.css (.orbs-hero, .orbs-cta, .orbs-panel).
export default function Orbs({ variant = "hero", className = "", ref }) {
  const innerRef = useRef(null);

  // Keep the caller's ref (used for scroll parallax) working alongside ours.
  const setRefs = useCallback(
    (node) => {
      innerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (reduce || !finePointer) return;

    let frame = 0;
    function onMove(e) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;
        el.style.setProperty("--mx", x.toFixed(3));
        el.style.setProperty("--my", y.toFixed(3));
      });
    }
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div ref={setRefs} aria-hidden="true" className={`orbs orbs-${variant} ${className}`}>
      <span className="orb orb-a" />
      <span className="orb orb-b" />
      <span className="orb orb-c" />
      <span className="orb orb-d" />
    </div>
  );
}
