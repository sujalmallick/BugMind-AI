import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import BrandMark from "../shared/BrandMark";
import Orbs from "../shared/Orbs";
import {
  MotionCard,
  WorkflowScene,
  ChecklistScene,
  TestCaseScene,
  TriageScene,
} from "../shared/MotionScenes";

const CHAPTERS = [
  { key: "modules", label: "Modules", file: "checkout_flow.txt", Scene: WorkflowScene },
  { key: "checklist", label: "Checklist", file: "checklist · 4 checks", Scene: ChecklistScene },
  { key: "cases", label: "Test cases", file: "grid · 4 cases", Scene: TestCaseScene },
  { key: "issues", label: "Issues", file: "BUG-402", Scene: TriageScene },
];

const INTERVAL = 650;
const HOLD = 4;

// A small "video player" that walks through what the four agents produce.
function Showcase() {
  const [index, setIndex] = useState(0);
  const chapter = CHAPTERS[index];

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const duration = (chapter.Scene.steps + HOLD) * INTERVAL;
    const id = setTimeout(() => setIndex((i) => (i + 1) % CHAPTERS.length), duration);
    return () => clearTimeout(id);
  }, [index, chapter.Scene.steps]);

  return (
    <div className="w-full max-w-[440px]">
      <div className="glass rounded-[20px] p-2">
        <MotionCard key={chapter.key} label={chapter.file} steps={chapter.Scene.steps} interval={INTERVAL} hold={HOLD}>
          {(step) => <chapter.Scene step={step} />}
        </MotionCard>
      </div>

      <div role="tablist" aria-label="Product preview" className="mt-5 grid grid-cols-4 gap-2">
        {CHAPTERS.map((c, i) => {
          const active = i === index;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setIndex(i)}
              className="group text-left"
            >
              <span className="block h-0.5 overflow-hidden rounded-full bg-hairline">
                {active && (
                  <span
                    key={index}
                    className="fill-bar block h-full rounded-full bg-ink"
                    style={{ animationDuration: `${(c.Scene.steps + HOLD) * INTERVAL}ms` }}
                  />
                )}
              </span>
              <span
                className={`mt-2 block text-[12px] font-medium transition-colors ${
                  active ? "text-ink" : "text-muted group-hover:text-ink"
                }`}
              >
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AuthLayout({ title, subtitle, children, footer }) {
  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-2">
      {/* Form column */}
      <div className="flex min-h-screen flex-col px-5 py-6 sm:px-10 sm:py-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            to="/landing"
            className="rounded-md transition-opacity hover:opacity-80"
            aria-label="BugMind AI home"
          >
            <BrandMark size="md" />
          </Link>
          <Link
            to="/landing"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="hidden xs:inline">Back to site</span>
            <span className="xs:hidden">Home</span>
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center py-10 sm:py-14">
          <div className="auth-card-enter w-full max-w-[360px]">
            <h1 className="text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-ink sm:text-[2rem]">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>
            )}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </div>
        </main>

        <footer className="text-[12px] text-muted">© {year} BugMind AI</footer>
      </div>

      {/* Showcase column */}
      <aside className="hidden p-3 lg:block" aria-label="What BugMind does">
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-hairline bg-paper px-10 py-12">
          <Orbs variant="panel" />
          <div className="relative w-full max-w-[440px]">
            <p className="eyebrow">Inside BugMind</p>
            <h2 className="mt-3 text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.03em] text-ink">
              One workflow in.
              <br />
              <span className="text-muted">A full test suite out.</span>
            </h2>
          </div>
          <div className="relative mt-10 w-full max-w-[440px]">
            <Showcase />
          </div>
        </div>
      </aside>
    </div>
  );
}
