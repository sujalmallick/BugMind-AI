import { useEffect, useRef, useState } from "react";
import { Check, CircleDot, Layers, AlertTriangle } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// "Video" cards: small looping product scenes rendered in the DOM.
// Each scene is driven by a step counter that only advances while the card is
// on screen. With reduced motion, scenes render their final frame, static.
// ─────────────────────────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

// Steps 0..steps-1 then holds on the last step for `hold` ticks before looping.
function useSceneLoop(steps, { interval = 650, hold = 4, active = true, reduced = false } = {}) {
  const [tick, setTick] = useState(0);
  const total = steps + hold;
  useEffect(() => {
    if (!active || reduced) return;
    const id = setInterval(() => setTick((t) => (t + 1) % total), interval);
    return () => clearInterval(id);
  }, [active, reduced, total, interval]);
  if (reduced) return { step: steps - 1, progress: 1 };
  return { step: Math.min(tick, steps - 1), progress: (tick + 1) / total };
}

export function MotionCard({ label, title, description, steps, interval, hold, children, className = "", compact = false }) {
  const ref = useRef(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref);
  const { step, progress } = useSceneLoop(steps, { interval, hold, active: inView, reduced });

  return (
    <figure ref={ref} className={`group flex flex-col ${className}`}>
      <div className="relative overflow-hidden rounded-2xl border border-hairline bg-paper">
        <div className="px-4 pt-3.5">
          <span className="font-mono text-[11px] text-muted">{label}</span>
        </div>
        <div className={`px-4 pb-6 pt-3 ${compact ? "min-h-[210px]" : "min-h-[240px]"}`}>{children(step)}</div>
        {/* playback bar */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] bg-hairline/70" aria-hidden="true">
          <div
            className="h-full bg-ink/70 transition-[width] duration-500 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
      {(title || description) && (
        <figcaption className="mt-4 px-0.5">
          {title && <p className="text-[15px] font-medium text-ink">{title}</p>}
          {description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>}
        </figcaption>
      )}
    </figure>
  );
}

// Fades/slides an element in once `show` becomes true
function Appear({ show, children, className = "" }) {
  return (
    <div
      className={`transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        show ? "translate-y-0 opacity-100" : "translate-y-1.5 opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

// ── Scene 1: workflow text → modules ────────────────────────────────────────
const WORKFLOW_TEXT = "User signs in → adds items to cart → applies promo → pays";
const MODULES = ["Auth & Session", "Cart", "Promo Engine", "Payments"];

export function WorkflowScene({ step }) {
  // steps 0-5 type the text, 6-9 reveal modules
  const typed = WORKFLOW_TEXT.slice(0, Math.round((Math.min(step, 5) / 5) * WORKFLOW_TEXT.length));
  const shown = Math.max(0, step - 5);
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-hairline bg-surface p-3 font-mono text-[12px] leading-relaxed text-ink">
        {typed}
        {step < 6 && <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 bg-ink/70 workflow-dot" />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {MODULES.map((m, i) => (
          <Appear key={m} show={shown > i}>
            <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2">
              <Layers size={13} className="shrink-0 text-signal" aria-hidden="true" />
              <span className="truncate text-[12px] font-medium text-ink">{m}</span>
            </div>
          </Appear>
        ))}
      </div>
    </div>
  );
}
WorkflowScene.steps = 10;

// ── Scene 2: checklist ticking ──────────────────────────────────────────────
const CHECKS = [
  "Promo applies before tax",
  "Negative quantity rejected",
  "Expired session resumes cart",
  "Gateway timeout shows retry",
];

export function ChecklistScene({ step }) {
  return (
    <ul className="space-y-2">
      {CHECKS.map((c, i) => {
        const done = step > i;
        return (
          <Appear key={c} show={step >= i}>
            <li className="flex items-center gap-2.5 rounded-lg border border-hairline bg-surface px-3 py-2.5">
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
                  done ? "border-verified bg-verified text-white" : "border-hairline-strong text-transparent"
                }`}
              >
                <Check size={10} strokeWidth={3} aria-hidden="true" />
              </span>
              <span className={`text-[12px] transition-colors duration-300 ${done ? "text-ink" : "text-muted"}`}>{c}</span>
            </li>
          </Appear>
        );
      })}
    </ul>
  );
}
ChecklistScene.steps = 5;

// ── Scene 3: test cases streaming into the grid ─────────────────────────────
const ROWS = [
  { id: "TC-101", t: "Apply valid promo code", s: "Ready", tone: "text-signal" },
  { id: "TC-102", t: "Reject expired promo", s: "Ready", tone: "text-signal" },
  { id: "TC-103", t: "3D Secure timeout", s: "Failed", tone: "text-flagged" },
  { id: "TC-104", t: "Cart persists on reload", s: "Passed", tone: "text-verified" },
];

export function TestCaseScene({ step }) {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface">
      <div className="grid grid-cols-[64px_1fr_56px] gap-2 border-b border-hairline px-3 py-2 text-[11px] font-medium text-muted">
        <span>ID</span>
        <span>Title</span>
        <span className="text-right">Status</span>
      </div>
      {ROWS.map((r, i) => (
        <Appear key={r.id} show={step > i}>
          <div className="grid grid-cols-[64px_1fr_56px] items-center gap-2 border-b border-hairline px-3 py-2.5 last:border-0">
            <span className="font-mono text-[11px] text-muted">{r.id}</span>
            <span className="truncate text-[12px] text-ink">{r.t}</span>
            <span className={`text-right font-mono text-[11px] font-medium ${r.tone}`}>{r.s}</span>
          </div>
        </Appear>
      ))}
    </div>
  );
}
TestCaseScene.steps = 5;

// ── Scene 4: bug triage ─────────────────────────────────────────────────────
const SEVERITIES = ["Unclassified", "Low", "Medium", "High"];

export function TriageScene({ step }) {
  const sev = SEVERITIES[Math.min(step, 3)];
  const tone = sev === "High" ? "text-flagged border-flagged/30 bg-flagged-soft" : "text-muted border-hairline bg-surface";
  return (
    <div className="space-y-3 rounded-lg border border-hairline bg-surface p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted">BUG-402</p>
          <p className="mt-0.5 text-[13px] font-medium text-ink">Promo field freezes checkout</p>
        </div>
        <span className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium transition-colors duration-300 ${tone}`}>
          {sev}
        </span>
      </div>
      <Appear show={step >= 4}>
        <div className="flex items-start gap-2 text-[12px] text-muted">
          <AlertTriangle size={13} className="mt-0.5 shrink-0 text-ochre" aria-hidden="true" />
          <span>Root cause: unhandled 404 from promo API</span>
        </div>
      </Appear>
      <Appear show={step >= 5}>
        <div className="flex items-start gap-2 text-[12px] text-muted">
          <CircleDot size={13} className="mt-0.5 shrink-0 text-signal" aria-hidden="true" />
          <span>Linked to TC-102 · Checkout module</span>
        </div>
      </Appear>
    </div>
  );
}
TriageScene.steps = 6;
