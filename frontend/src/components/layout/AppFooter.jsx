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

export default function AppFooter() {
  const navigate = useNavigate();
  const { authenticated } = useAuth();
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-hairline bg-surface">
      <div className="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col items-start">
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
