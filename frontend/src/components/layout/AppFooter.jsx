import {
  ExternalLink,
  ShieldCheck,
  ArrowUp,
  Heart,
  Cpu,
  Database,
  Code2,
  Terminal,
  Globe
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
        className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-500 transition-all duration-200 hover:text-blue-600 hover:translate-x-0.5"
      >
        {label}
        <ExternalLink
          size={12}
          className="text-gray-400 opacity-60 transition-all duration-200 group-hover:opacity-100 group-hover:text-blue-600 group-hover:translate-x-0.5"
        />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-gray-500 transition-all duration-200 hover:text-blue-600 hover:translate-x-0.5 text-left"
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
    <footer className="relative mt-20 bg-white/90 backdrop-blur-md">

      {/* Back to top float button trigger */}
      <div className="absolute right-6 -top-5 sm:right-10">
        <button
          type="button"
          onClick={scrollToTop}
          title="Back to Top"
          className="group flex h-10 w-10 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-md transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 hover:shadow-lg active:scale-90 text-gray-600"
        >
          <ArrowUp size={18} className="transition-transform duration-200 group-hover:-translate-y-0.5" />
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">

        {/* Top main grid */}
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr_1fr]">

          {/* Col 1: Brand & Info */}
          <div className="flex flex-col items-start">
            <div
              title="Go to Projects"
              onClick={() => navigate("/")}
              className="group flex cursor-pointer items-center gap-3 transition-transform duration-200 active:scale-95"
            >
              <img
                src={favicon}
                alt="BugMind"
                className="h-10 w-10 object-contain transition-transform duration-300 group-hover:scale-105"
              />
              <img
                src={logo}
                alt="BugMind AI"
                className="h-9 w-auto object-contain transition-opacity duration-200 group-hover:opacity-85"
              />
            </div>

            <p className="mt-4 text-xs sm:text-sm leading-relaxed text-gray-500 max-w-sm">
              The AI copilot for exploratory QA. Transform loose testing notes into structured, execution-ready test cases, modules, and issue reports in seconds.
            </p>

            {/* Status & Badge */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Systems Operational
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-1.5 text-xs font-semibold text-blue-800 shadow-2xs">
                <ShieldCheck size={13} className="text-blue-600" />
                Tester First
              </span>
            </div>
          </div>

          {/* Col 2: Navigation */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Globe size={13} className="text-blue-600" />
              Explore Hub
            </h4>
            <div className="mt-4 flex flex-col gap-2.5">
              <FooterLink
                label="Projects Workspace"
                onClick={() => navigate("/")}
              />
              <FooterLink
                label="AI Execution Dashboard"
                onClick={() => navigate("/dashboard")}
              />
              <FooterLink
                label="Organizations & Teams"
                onClick={() => navigate("/organizations")}
              />
            </div>
          </div>

          {/* Col 3: Tech Stack Badge Cards */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
              <Cpu size={13} className="text-purple-600" />
              Built With
            </h4>
            <div className="mt-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-white hover:border-gray-200">
                <Code2 size={14} className="text-blue-500 shrink-0" />
                <span>React + Vite + Tailwind</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-white hover:border-gray-200">
                <Terminal size={14} className="text-emerald-500 shrink-0" />
                <span>FastAPI + Python 3.11</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2 text-xs font-medium text-gray-700 shadow-2xs transition-colors hover:bg-white hover:border-gray-200">
                <Database size={14} className="text-indigo-500 shrink-0" />
                <span>PostgreSQL + Alembic</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col gap-3 border-t border-gray-200/80 pt-6 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span>© {year} BugMind AI. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-4 text-gray-400">
            <span className="flex items-center gap-1 text-gray-500">
              Crafted with <Heart size={12} className="fill-red-500 text-red-500" /> for modern QA teams
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
}
