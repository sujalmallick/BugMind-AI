import { useEffect, useRef } from "react";

// Calls `onEscape` when Escape is pressed while `active` is true.
export default function useEscapeKey(active, onEscape) {
  const handlerRef = useRef(onEscape);

  // Keep the latest handler without re-subscribing on every render
  useEffect(() => {
    handlerRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === "Escape") handlerRef.current?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
}
