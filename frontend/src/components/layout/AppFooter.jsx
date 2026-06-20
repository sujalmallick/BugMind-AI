import { ExternalLink, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

function FooterLink({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink"
    >
      {label}
      <ExternalLink
        size={12}
        className="opacity-0 transition group-hover:opacity-60"
      />
    </button>
  );
}

export default function AppFooter() {
  const navigate = useNavigate();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-14 border-t border-hairline/80 bg-white/85 backdrop-blur">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="flex items-center gap-3"
            >
              <img
                src={favicon}
                alt="BugMind"
                className="h-9 w-9 object-contain"
              />

              <img
                src={logo}
                alt="BugMind AI"
                className="h-10 w-auto object-contain"
              />
            </button>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              QA workspace for turning exploratory workflows into practical,
              execution-ready testing outputs.
            </p>

            <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck size={13} />
              Built by a tester, for testers
            </span>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Explore
            </h4>
            <div className="mt-3 flex flex-col gap-2">
              <FooterLink
                label="Projects Dashboard"
                onClick={() => navigate("/")}
              />
              <FooterLink
                label="Workspace Studio"
                onClick={() => navigate("/", { replace: false })}
              />
              <span className="text-sm text-muted">Execution Tracker</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Built With
            </h4>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              <span>React + Vite</span>
              <span>FastAPI + PostgreSQL</span>
              <span>LLM-assisted QA workflow</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              About
            </h4>
            <div className="mt-3 flex flex-col gap-2 text-sm text-muted">
              <span>BugMind AI Project</span>
              <a
                href="mailto:support@bugmind.ai"
                className="transition hover:text-ink"
              >
                Contact
              </a>
              <span>Always improving</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 border-t border-hairline pt-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {year} BugMind AI</span>
          <span>Made with focus on practical testing workflows.</span>
        </div>
      </div>
    </footer>
  );
}
