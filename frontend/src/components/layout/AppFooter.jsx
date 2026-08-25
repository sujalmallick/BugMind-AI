import {
  ExternalLink,
  ShieldCheck,
  ArrowUp,
  Folder,
  LayoutDashboard,
  Users,
  KeyRound,
  FileSpreadsheet,
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
        className="group inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors duration-150 hover:text-ink"
      >
        {label}
        <ExternalLink
          size={11}
          className="text-muted/60 transition-colors duration-150 group-hover:text-ink"
        />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center text-[13px] text-muted transition-colors duration-150 hover:text-ink text-left"
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
    <footer className="relative border-t border-hairline bg-surface">

      {/* Back to top button */}
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

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Main grid */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">

          {/* Col 1: Brand & Status */}
          <div className="flex flex-col items-start">
            <button
              type="button"
              onClick={() => navigate("/landing")}
              className="flex shrink-0 items-center gap-2.5 transition-opacity duration-150 hover:opacity-85 active:scale-[0.98] focus-visible:outline-none rounded-sm"
              aria-label="BugMind AI"
            >
              <img src={favicon} alt="" aria-hidden="true" className="h-8 w-8 object-contain" />
              <img src={logo} alt="BugMind AI" className="h-[28px] w-auto object-contain" />
            </button>


            <p className="mt-2.5 text-[12px] leading-normal text-muted font-sans max-w-xs">
              AI-assisted QA workflow engine and exploratory test management.
            </p>

            <div className="mt-3.5 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded border border-hairline bg-paper px-2 py-0.5 font-mono text-[11px] text-ink">
                <span className="h-1.5 w-1.5 rounded-full bg-verified shrink-0" />
                Systems Operational
              </span>
            </div>
          </div>

          {/* Col 2: Workspace */}
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
              Workspace
            </h4>
            <div className="mt-3 flex flex-col gap-2">
              <FooterLink
                label="Projects Hub"
                onClick={() => navigate("/projects")}
              />
              <FooterLink
                label="Execution Dashboard"
                onClick={() => navigate("/dashboard")}
              />
              <FooterLink
                label="Organizations & Teams"
                onClick={() => navigate("/organizations")}
              />
              <FooterLink
                label="Activity Feed"
                onClick={() => navigate("/activity")}
              />
            </div>
          </div>


          {/* Col 3: Product Capabilities */}
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
              Platform
            </h4>
            <div className="mt-3 flex flex-col gap-2">
              <FooterLink
                label="4-Agent QA Pipeline"
                onClick={() => navigate("/details#pipeline")}
              />
              <FooterLink
                label="Spreadsheet Test Grid"
                onClick={() => navigate("/details#workspace")}
              />
              <FooterLink
                label="Bring Your Own Key (BYOK)"
                onClick={() => navigate("/profile")}
              />
              <FooterLink
                label="CSV & Excel Importer"
                onClick={() => navigate("/")}
              />
            </div>
          </div>

          {/* Col 4: Account & Security */}
          <div>
            <h4 className="text-[12px] font-semibold uppercase tracking-wider text-ink">
              Account
            </h4>
            <div className="mt-3 flex flex-col gap-2">
              <FooterLink
                label="Sign In"
                onClick={() => navigate("/login")}
              />
              <FooterLink
                label="Create Free Account"
                onClick={() => navigate("/register")}
              />
              <FooterLink
                label="Profile & AI Settings"
                onClick={() => navigate("/profile")}
              />
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col gap-2 border-t border-hairline pt-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between font-mono">
          <p>
            © {year} BugMind AI. All rights reserved.
          </p>

          <div className="flex items-center gap-4 text-muted">
            <span className="inline-flex items-center gap-1">
              <ShieldCheck size={12} className="text-verified" />
              Role-Based Access
            </span>
            <span>•</span>
            <span>Version 1.0.0</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

