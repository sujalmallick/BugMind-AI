import { ArrowUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import BrandMark from "../shared/BrandMark";

function FooterLink({ label, onClick }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="rounded-sm text-left text-[13px] text-muted transition-colors duration-150 hover:text-ink"
      >
        {label}
      </button>
    </li>
  );
}

function FooterColumn({ title, children }) {
  return (
    <div>
      <h4 className="text-[13px] font-medium text-ink">{title}</h4>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

const APP_FOOTER_LINKS = [
  { label: "Projects", to: "/" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Organizations", to: "/organizations" },
  { label: "AI keys", to: "/settings/profile?tab=keys" },
  { label: "Settings", to: "/profile" },
  { label: "Help & FAQ", to: "/details#faq" },
];

// Inside the app the footer is a slim inset glass bar that mirrors the header,
// so screens stay focused on the work. The full multi-column footer is only
// used on the marketing page (variant="full").
export default function AppFooter({ variant = "compact" }) {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="mt-auto px-3 pb-3 pt-6 sm:px-4">
        <div className="glass-header mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="rounded-md transition-opacity hover:opacity-80"
              aria-label="BugMind AI home"
            >
              <BrandMark size="sm" />
            </button>
            <span className="h-4 w-px bg-hairline-strong" aria-hidden="true" />
            <p className="text-[12px] text-muted">© {year} BugMind AI</p>
          </div>

          <div className="flex items-center justify-between gap-4 sm:justify-end">
            <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-1 gap-y-1">
              {APP_FOOTER_LINKS.map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => navigate(l.to)}
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-ink/60 transition-colors hover:bg-white/70 hover:text-ink"
                >
                  {l.label}
                </button>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              aria-label="Back to top"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted ring-1 ring-ink/[0.06] transition-colors hover:bg-white/70 hover:text-ink"
            >
              <ArrowUp size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-12 sm:px-6 sm:pt-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="col-span-2 flex flex-col items-start lg:col-span-1">
            <button
              type="button"
              onClick={() => navigate("/landing")}
              className="rounded-md transition-opacity duration-150 hover:opacity-80"
              aria-label="BugMind AI home"
            >
              <BrandMark size="md" />
            </button>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted">
              AI-assisted QA workflow engine and exploratory test management.
            </p>
          </div>

          <FooterColumn title="Workspace">
            <FooterLink label="Projects" onClick={() => navigate("/projects")} />
            <FooterLink label="Dashboard" onClick={() => navigate("/dashboard")} />
            <FooterLink label="Organizations" onClick={() => navigate("/organizations")} />
            <FooterLink label="Activity" onClick={() => navigate("/activity")} />
          </FooterColumn>

          <FooterColumn title="Product">
            <FooterLink label="QA pipeline" onClick={() => navigate("/details#pipeline")} />
            <FooterLink label="Test grid" onClick={() => navigate("/details#workspace")} />
            <FooterLink label="Teams & access" onClick={() => navigate("/details#collaboration")} />
            <FooterLink label="FAQ" onClick={() => navigate("/details#faq")} />
          </FooterColumn>

          <FooterColumn title="Account">
            {authenticated ? (
              <>
                <FooterLink label="Profile" onClick={() => navigate("/profile")} />
                <FooterLink label="AI keys" onClick={() => navigate("/settings/profile?tab=keys")} />
              </>
            ) : (
              <>
                <FooterLink label="Sign in" onClick={() => navigate("/login")} />
                <FooterLink label="Create account" onClick={() => navigate("/register")} />
              </>
            )}
          </FooterColumn>
        </div>

        <div className="mt-12 flex items-center justify-between gap-4 border-t border-hairline pt-6 text-[12px] text-muted">
          <p>© {year} BugMind AI</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-ink/[0.04] hover:text-ink"
          >
            Back to top
            <ArrowUp size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </footer>
  );
}
