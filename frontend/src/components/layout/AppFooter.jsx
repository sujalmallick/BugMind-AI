import {
  ExternalLink,
  ShieldCheck,
  ArrowUp,
  Heart,
  Cpu,
  Database,
  Code2,
  Terminal,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

function FooterLink({ label, onClick, external = false, href = "#" }) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink"
      >
        {label}
        <ExternalLink
          size={12}
          className="text-muted/60 transition-colors duration-150 group-hover:text-ink"
        />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors duration-150 hover:text-ink text-left"
    >
      {label}
    </button>
  );
}

export default function AppFooter() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative mt-20 border-t border-hairline bg-surface">

      {/* Back to top button — matching header IconBtn anatomy */}
      <div className="absolute right-6 -top-4 sm:right-8">
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Back to top"
          title="Back to top"
          className="
            relative flex h-[34px] w-[34px] items-center justify-center
            rounded-md border border-hairline bg-surface
            text-muted transition-colors duration-150
            hover:border-ink/30 hover:bg-paper hover:text-ink
            active:scale-[0.98]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40
          "
        >
          <ArrowUp size={15} aria-hidden="true" />
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Main grid */}
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr_1fr]">

          {/* Col 1: Brand & Description */}
          <div className="flex flex-col items-start">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/40 rounded-sm py-0.5"
              aria-label="BugMind AI — home"
            >
              <img src={favicon} alt="" aria-hidden="true" className="h-9 w-9 object-contain" />
              <img src={logo} alt="BugMind AI" className="h-[32px] w-auto object-contain" />
            </button>

            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted font-sans">
              The copilot for exploratory QA. Transform loose testing notes into structured test cases, modules, and issue reports in seconds.
            </p>

            {/* Operational status badges — flat styling */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
                <span className="h-2 w-2 rounded-full bg-verified shrink-0" />
                Systems operational
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-paper px-2.5 py-1 text-[12px] font-medium text-ink">
                <ShieldCheck size={13} className="text-signal shrink-0" />
                Tester-first architecture
              </span>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
              <Globe size={13} className="text-muted" aria-hidden="true" />
              Navigation
            </h4>
            <div className="mt-3 flex flex-col gap-2">
              <FooterLink
                label="Projects workspace"
                onClick={() => navigate("/")}
              />
              <FooterLink
                label="Dashboard"
                onClick={() => navigate("/dashboard")}
              />
              <FooterLink
                label="Organizations & teams"
                onClick={() => navigate("/organizations")}
              />
            </div>
          </div>

          {/* Col 3: Stack info */}
          <div>
            <h4 className="text-[13px] font-semibold text-ink flex items-center gap-1.5">
              <Cpu size={13} className="text-muted" aria-hidden="true" />
              Architecture
            </h4>
            <div className="mt-3 flex flex-col gap-1.5 font-mono text-[11px] text-muted">
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5">
                <Code2 size={13} className="text-signal shrink-0" />
                <span>React + Vite + Tailwind</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5">
                <Terminal size={13} className="text-verified shrink-0" />
                <span>FastAPI + Python 3.11</span>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-hairline bg-paper px-2.5 py-1.5">
                <Database size={13} className="text-signal shrink-0" />
                <span>PostgreSQL + Alembic</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col gap-2 border-t border-hairline pt-5 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[11px]">
            © {year} BugMind AI. All rights reserved.
          </p>

          <p className="flex items-center gap-1 text-muted text-[12px]">
            Built with <Heart size={12} className="fill-flagged text-flagged" /> for software engineering teams
          </p>
        </div>

      </div>
    </footer>
  );
}
