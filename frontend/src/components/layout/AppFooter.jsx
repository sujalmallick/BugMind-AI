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

const APP_FOOTER_GROUPS = [
  {
    title: "Workspace",
    links: [
      { label: "Projects", to: "/" },
      { label: "Dashboard", to: "/dashboard" },
      { label: "Organizations", to: "/organizations" },
    ],
  },
  {
    title: "Account",
    links: [
      { label: "Settings", to: "/profile" },
      { label: "AI keys", to: "/settings/profile?tab=keys" },
      { label: "Notifications", to: "/settings/profile?tab=notifications" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Product tour", to: "/details" },
      { label: "Help & FAQ", to: "/details#faq" },
    ],
  },
];

// Inside the app: a quiet, tinted footer (distinct from the floating header)
// with short link groups. The full marketing footer is variant="full".
export default function AppFooter({ variant = "compact" }) {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="glass-strip mt-auto border-t border-white/70 shadow-[0_-1px_0_rgba(9,10,15,0.05)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-col gap-6 py-7 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="rounded-md transition-opacity hover:opacity-80"
                aria-label="BugMind AI home"
              >
                <BrandMark size="sm" />
              </button>
              <p className="mt-2.5 text-[12px] leading-relaxed text-muted">
                AI-assisted QA workflow engine and exploratory test management.
              </p>
            </div>

            <nav aria-label="Footer" className="grid grid-cols-3 gap-x-8 gap-y-2 sm:gap-x-14">
              {APP_FOOTER_GROUPS.map((group) => (
                <div key={group.title}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted/80">{group.title}</p>
                  <ul className="mt-2.5 space-y-1.5">
                    {group.links.map((l) => (
                      <li key={l.label}>
                        <button
                          type="button"
                          onClick={() => navigate(l.to)}
                          className="text-left text-[13px] text-ink/70 transition-colors hover:text-ink"
                        >
                          {l.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-hairline py-3.5 text-[12px] text-muted">
            <p>© {year} BugMind AI · All rights reserved</p>
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
            <FooterLink label="Automation" onClick={() => navigate("/details#automation")} />
            <FooterLink label="Test grid" onClick={() => navigate("/details#workspace")} />
            <FooterLink label="Teams & security" onClick={() => navigate("/details#collaboration")} />
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
