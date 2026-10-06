import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Layers,
  ShieldCheck,
  FileSpreadsheet,
  Bug,
  Users,
  KeyRound,
  ChevronDown,
  ListChecks,
  Check,
  XCircle,
  Clock,
  ChevronRight,
  User,
  LogOut,
  Folder,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import UserAvatar from "../components/common/UserAvatar";
import BrandMark from "../components/shared/BrandMark";
import Orbs from "../components/shared/Orbs";
import AppFooter from "../components/layout/AppFooter";
import useReveal from "../hooks/useReveal";
import {
  MotionCard,
  WorkflowScene,
  ChecklistScene,
  TestCaseScene,
  TriageScene,
} from "../components/shared/MotionScenes";

const NAV_LINKS = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#workspace", label: "Workspace" },
  { href: "#collaboration", label: "Teams" },
  { href: "#faq", label: "FAQ" },
];

// ── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ id, question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-hairline last:border-0">
      <h3>
        <button
          type="button"
          id={`${id}-q`}
          aria-expanded={open}
          aria-controls={`${id}-a`}
          onClick={() => setOpen(!open)}
          className="flex w-full items-center justify-between gap-6 py-5 text-left text-[15px] font-medium text-ink transition-colors hover:text-signal"
        >
          {question}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={`shrink-0 text-muted transition-transform duration-300 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h3>
      <div
        id={`${id}-a`}
        role="region"
        aria-labelledby={`${id}-q`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <p className="max-w-2xl pb-5 pr-8 text-[14px] leading-relaxed text-muted">{answer}</p>
        </div>
      </div>
    </div>
  );
}

// ── Section heading ──────────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, accent, children, align = "center" }) {
  const alignCls = align === "center" ? "mx-auto text-center" : "";
  return (
    <div className={`reveal max-w-2xl ${alignCls}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.5rem]">
        {title}{" "}
        {accent && <span className="text-signal">{accent}</span>}
      </h2>
      {children && <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-base">{children}</p>}
    </div>
  );
}

// ── Pipeline Agent Step Data ─────────────────────────────────────────────────
const AGENT_STEPS = [
  {
    id: 1,
    agent: "Module Agent",
    role: "Domain decomposition",
    icon: Layers,
    desc: "Analyzes raw workflow descriptions and partitions them into clean domain boundaries, critical paths, and module hierarchy.",
    codePreview: {
      type: "Modules generated",
      items: [
        { name: "Auth & Identity", status: "Protected", badge: "Core" },
        { name: "Cart & Checkout Flow", status: "Critical path", badge: "High risk" },
        { name: "Promo & Billing Engine", status: "Monetary", badge: "P0" },
      ],
    },
  },
  {
    id: 2,
    agent: "Checklist Agent",
    role: "Exploratory test strategist",
    icon: ListChecks,
    desc: "Synthesizes comprehensive exploratory testing checklists, boundary conditions, edge cases, and user experience checkpoints.",
    codePreview: {
      type: "Exploratory checklist",
      items: [
        { name: "Instant subtotal recalculation on promo code apply", status: "Passed", badge: "Functional" },
        { name: "Zero & negative quantity entry validation", status: "Passed", badge: "Boundary" },
        { name: "Expired JWT token recovery during active checkout", status: "Verified", badge: "Security" },
      ],
    },
  },
  {
    id: 3,
    agent: "Test Case Agent",
    role: "Manual execution writer",
    icon: FileSpreadsheet,
    desc: "Transforms requirements into execution-ready manual test cases with preconditions, step-by-step actions, and expected results.",
    codePreview: {
      type: "Execution-ready test cases",
      items: [
        { name: "TC-101: Apply valid 20% discount code at checkout", status: "Ready", badge: "High" },
        { name: "TC-102: Handle 3D Secure bank verification timeout", status: "Ready", badge: "Critical" },
        { name: "TC-103: Persist cart items across browser tab reloads", status: "Ready", badge: "Medium" },
      ],
    },
  },
  {
    id: 4,
    agent: "Issue Agent",
    role: "Defect analysis & triage",
    icon: Bug,
    desc: "Ingests bug observations and failed executions to classify severity, map root causes, and write clean reproduction steps.",
    codePreview: {
      type: "Classified defect reports",
      items: [
        { name: "BUG-401: Invalid promo code freezes checkout CTA", status: "High", badge: "API 404" },
        { name: "BUG-402: Cart total displays NaN on rapid currency switch", status: "Medium", badge: "State desync" },
      ],
    },
  },
];

const STATUS_TONE = {
  Passed: "text-verified",
  Failed: "text-flagged",
  Ready: "text-signal",
};

const STACKED_TEST_CASES = [
  {
    id: "TC-0101",
    module: "Auth Flow",
    title: "Verify login with valid OAuth credentials",
    status: "Passed",
    priority: "P0 Critical",
    steps: "1. Click 'Sign in with Google' → 2. Complete OAuth popup → 3. Verify session token saved",
    expected: "Redirects to Dashboard with auth cookie and active session.",
    tag: "cf_sprint_14",
  },
  {
    id: "TC-0102",
    module: "Billing & Checkout",
    title: "Apply invalid promo code during active checkout",
    status: "Failed",
    priority: "P1 High",
    steps: "1. Open cart with $100 total → 2. Type 'INVALID50' in promo field → 3. Click Apply",
    expected: "Inline error toast shown, subtotal remains $100.00 without freeze.",
    tag: "cf_promo_bug",
  },
  {
    id: "TC-0103",
    module: "Notifications",
    title: "Receive real-time SSE push alerts on test status change",
    status: "Ready",
    priority: "P2 Normal",
    steps: "1. Connect SSE client → 2. Update bug status to Resolved → 3. Verify real-time notification event",
    expected: "Unread count increments instantly via SSE event stream.",
    tag: "cf_sse_audit",
  },
  {
    id: "TC-0104",
    module: "Spreadsheet Grid",
    title: "Export 500+ test cases to XLSX with custom columns",
    status: "Passed",
    priority: "P1 High",
    steps: "1. Select all 500 rows → 2. Click Export to Excel → 3. Verify custom cf_ fields preserved",
    expected: "Downloaded .xlsx file matches grid column order and data types exactly.",
    tag: "cf_export_v2",
  },
];

const DEMO_TABS = [
  { id: "modules", label: "Modules", icon: Layers },
  { id: "checklist", label: "Checklist", icon: ListChecks },
  { id: "testcases", label: "Test cases", icon: FileSpreadsheet },
  { id: "issues", label: "Issues", icon: Bug },
];

const TEAM_FEATURES = [
  {
    icon: Users,
    title: "Organizations & teams",
    body: "Group projects under central organizations. Invite members as Owner, Admin, Member or Viewer.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Control who can edit test cases, re-analyze workflows, manage API keys or delete project data.",
  },
  {
    icon: KeyRound,
    title: "Bring your own key",
    body: "Connect your own Gemini, OpenAI or other provider keys for full control over AI quotas.",
  },
];

const FAQS = [
  {
    q: "What input does BugMind AI need to generate test cases?",
    a: "BugMind accepts plain text descriptions of your application's user flows, feature specifications, or user stories. You don't need to write code, scripts, or formal syntax.",
  },
  {
    q: "Does BugMind AI scan repository code or run CI/CD bots?",
    a: "No. BugMind is a QA workflow and test management tool designed for QA engineers, product managers, and developers. It generates structured test plans and manages execution directly from functional workflow descriptions — it does not analyze source code or run AST parsing.",
  },
  {
    q: "Can I import my existing spreadsheet test cases?",
    a: "Yes. BugMind includes a built-in CSV and Excel (.xlsx) importer that auto-detects column headers and maps them into your project's spreadsheet grid.",
  },
  {
    q: "How does Bring Your Own Key (BYOK) work?",
    a: "You can enter your own API key (e.g., Google Gemini) in your account profile. BugMind uses your key directly for AI requests, keeping your usage separate and under your own provider quota.",
  },
  {
    q: "Can team members collaborate on the same project?",
    a: "Yes. Projects can be created within Organizations or Teams. Multiple team members can view, edit, and track test case execution in real-time.",
  },
];

// Small, neutral status label used across the demo panels
function Tag({ children, tone = "text-muted" }) {
  return (
    <span className={`shrink-0 rounded-md border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] font-medium ${tone}`}>
      {children}
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { authenticated, user, logout } = useAuth();
  const pageRef = useReveal();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  const [scrolled, setScrolled] = useState(false);
  const heroMockRef = useRef(null);
  const heroTextRef = useRef(null);
  const heroOrbsRef = useRef(null);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);

  const [activeStackIndex, setActiveStackIndex] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState("right");

  const [demoWorkflow, setDemoWorkflow] = useState(
    "User logs in → Navigates to Dashboard → Clicks 'Create Invoice' → Enters line items & client details → Applies 20% promo code → Submits payment"
  );
  const [demoActiveTab, setDemoActiveTab] = useState("modules");

  const triggerCardSwipe = (targetStatus) => {
    if (isSwiping) return;
    setSwipeDir(targetStatus === "Failed" ? "left" : "right");
    setIsSwiping(true);
    setTimeout(() => {
      setActiveStackIndex((prev) => (prev + 1) % STACKED_TEST_CASES.length);
      setIsSwiping(false);
    }, 240);
  };

  // Close profile menu on outside click / Escape
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") {
        setProfileDropdownOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  // Header state + hero scroll effect: the headline fades and drifts down
  // while the product mockup glides up over it (desktop only, motion-safe).
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 8);
        const mock = heroMockRef.current;
        const text = heroTextRef.current;
        const enabled = !reduceMotion && window.innerWidth >= 768;
        if (mock) {
          const rise = Math.max(-200, -y * 0.35);
          const scale = Math.min(1.02, 0.985 + y * 0.0001);
          mock.style.transform = enabled ? `translate3d(0, ${rise}px, 0) scale(${scale})` : "";
        }
        const orbs = heroOrbsRef.current;
        if (orbs) {
          orbs.style.transform = enabled ? `translate3d(0, ${y * 0.25}px, 0)` : "";
        }
        if (text) {
          text.style.opacity = enabled ? String(Math.max(0.15, 1 - y * 0.002)) : "";
          text.style.transform = enabled ? `translate3d(0, ${y * 0.1}px, 0)` : "";
        }
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const primaryCta = authenticated && user
    ? { label: "Open workspace", to: "/" }
    : { label: "Start testing free", to: "/register" };

  const currentTest = STACKED_TEST_CASES[activeStackIndex];
  const step = AGENT_STEPS[activeAgentIndex];

  return (
    <div ref={pageRef} className="relative min-h-screen bg-surface font-sans text-ink overflow-x-clip">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
        <div className={`glass-header mx-auto w-full max-w-6xl rounded-2xl ${scrolled ? "is-scrolled" : ""}`}>
        <div className="flex h-14 items-center justify-between gap-4 pl-3 pr-2 sm:pl-4">
          <Link
            to="/landing"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="rounded-md transition-opacity hover:opacity-80"
            aria-label="BugMind AI home"
          >
            <BrandMark size="md" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink/70 transition-colors hover:bg-white/70 hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {authenticated && user ? (
              <>
                <button type="button" onClick={() => navigate("/")} className="btn-primary hidden xs:inline-flex">
                  Open workspace
                  <ArrowRight size={14} aria-hidden="true" />
                </button>

                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    aria-label="Open user menu"
                    aria-haspopup="menu"
                    aria-expanded={profileDropdownOpen}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-1 ring-hairline transition-shadow hover:ring-2 hover:ring-signal/30"
                  >
                    <UserAvatar user={user} size="md" initials={initials} className="h-full w-full" />
                  </button>

                  {profileDropdownOpen && (
                    <div role="menu" className="glass glass-menu menu-enter absolute right-0 top-full z-50 mt-2 w-60 rounded-xl p-1.5">
                      <div className="border-b border-hairline px-3 pb-2.5 pt-2">
                        <p className="truncate text-[13px] font-semibold text-ink">{user.name || "User"}</p>
                        <p className="truncate font-mono text-[11px] text-muted">{user.email}</p>
                      </div>
                      <div className="mt-1 text-[13px]">
                        {[
                          { icon: Folder, label: "Projects", to: "/" },
                          { icon: LayoutDashboard, label: "Dashboard", to: "/dashboard" },
                          { icon: User, label: "Profile & AI settings", to: "/profile" },
                        ].map(({ icon: Icon, label, to }) => (
                          <button
                            key={label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setProfileDropdownOpen(false);
                              navigate(to);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-ink transition-colors hover:bg-ink/[0.04]"
                          >
                            <Icon size={14} className="text-muted" aria-hidden="true" />
                            {label}
                          </button>
                        ))}
                        <div className="my-1 h-px bg-hairline" />
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-flagged transition-colors hover:bg-flagged-soft"
                        >
                          <LogOut size={14} aria-hidden="true" />
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="hidden rounded-lg px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-ink/[0.04] xs:inline-flex"
                >
                  Sign in
                </button>
                <button type="button" onClick={() => navigate("/register")} className="btn-primary">
                  Get started
                  <ArrowRight size={14} aria-hidden="true" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              aria-controls="landing-mobile-nav"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-surface text-ink transition-colors hover:bg-paper md:hidden"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div id="landing-mobile-nav" className="menu-enter border-t border-hairline/70 px-2 pb-3 pt-2 md:hidden">
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-ink/[0.04]"
                >
                  {l.label}
                  <ChevronRight size={15} className="text-muted" aria-hidden="true" />
                </a>
              ))}
            </nav>
            {!authenticated && (
              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-hairline pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/login");
                  }}
                  className="btn-secondary"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/register");
                  }}
                  className="btn-primary"
                >
                  Get started
                </button>
              </div>
            )}
          </div>
        )}
        </div>
      </header>

      <main className="relative">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative -mt-[4.25rem] overflow-x-clip pb-14 pt-28 sm:pt-40 md:pb-4">
          <Orbs ref={heroOrbsRef} variant="hero" className="will-change-transform" />
          <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
            <div ref={heroTextRef} className="relative z-10 mx-auto max-w-3xl text-center will-change-transform">
              <p className="stagger eyebrow" style={{ "--d": "0ms" }}>
                Four-agent QA pipeline
              </p>

              <h1
                className="stagger mt-5 text-[2.375rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink xs:text-[2.75rem] sm:text-6xl lg:text-[4.5rem]"
                style={{ "--d": "80ms" }}
              >
                Plain‑text workflows,{" "}
                <span className="text-signal">
                  execution‑ready QA.
                </span>
              </h1>

              <p
                className="stagger mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:mt-6 sm:text-lg"
                style={{ "--d": "160ms" }}
              >
                Describe how your application works. BugMind decomposes modules, drafts
                exploratory checklists, writes manual test cases and classifies bug reports.
              </p>

              <div
                className="stagger mt-8 flex flex-col items-stretch justify-center gap-2.5 xs:flex-row xs:items-center sm:mt-9 sm:gap-3"
                style={{ "--d": "240ms" }}
              >
                <button
                  type="button"
                  onClick={() => navigate(primaryCta.to)}
                  className="btn-primary group !min-h-11 !px-5 !text-[15px]"
                >
                  {primaryCta.label}
                  <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
                {authenticated && user ? (
                  <button type="button" onClick={() => navigate("/profile")} className="btn-secondary !min-h-11 !px-5 !text-[15px]">
                    Account settings
                  </button>
                ) : (
                  <a href="#pipeline" className="btn-secondary !min-h-11 !px-5 !text-[15px]">
                    See how it works
                  </a>
                )}
              </div>

              <p className="stagger mt-5 text-[13px] text-muted" style={{ "--d": "320ms" }}>
                {authenticated && user ? (
                  <>Signed in as <span className="font-medium text-ink">{user.email}</span></>
                ) : (
                  <>No credit card required · Bring your own API key</>
                )}
              </p>
            </div>

            {/* ── Product mockup ───────────────────────────────────────── */}
            <div className="stagger relative z-20 mx-auto mt-12 max-w-5xl sm:mt-20" style={{ "--d": "420ms" }}>
              <div ref={heroMockRef} className="glass relative z-20 rounded-2xl p-2 will-change-transform">
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex shrink-0 gap-1.5" aria-hidden="true">
                        <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
                        <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
                        <span className="h-2.5 w-2.5 rounded-full bg-hairline-strong" />
                      </div>
                      <span className="truncate font-mono text-[11px] text-muted">invoice_workflow.txt</span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified" aria-hidden="true" />
                      4 agents ready
                    </span>
                  </div>

                  <div className="grid lg:grid-cols-12">
                    {/* Input */}
                    <div className="flex flex-col border-b border-hairline p-4 sm:p-5 lg:col-span-5 lg:border-b-0 lg:border-r">
                      <label htmlFor="demo-workflow" className="text-[12px] font-medium text-ink">
                        Describe the user flow
                      </label>
                      <textarea
                        id="demo-workflow"
                        value={demoWorkflow}
                        onChange={(e) => setDemoWorkflow(e.target.value)}
                        rows={4}
                        className="mt-2 w-full flex-1 resize-none rounded-lg border border-hairline bg-paper p-3 font-mono text-[12px] leading-relaxed text-ink transition-colors placeholder:text-muted focus:border-signal focus:bg-surface focus:outline-none"
                        placeholder="Describe user flow…"
                      />
                      <p className="mt-3 text-[12px] text-muted">
                        Switch tabs to inspect what each agent produces.
                      </p>
                    </div>

                    {/* Output */}
                    <div className="flex flex-col p-4 sm:p-5 lg:col-span-7 lg:min-h-[300px]">
                      <div
                        role="tablist"
                        aria-label="Agent outputs"
                        className="grid grid-cols-2 gap-1 rounded-lg bg-paper p-1 sm:grid-cols-4"
                      >
                        {DEMO_TABS.map((tab, i) => {
                          const Icon = tab.icon;
                          const active = demoActiveTab === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setDemoActiveTab(tab.id)}
                              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium transition-all duration-200 ${
                                active
                                  ? "bg-surface text-ink shadow-[0_1px_2px_rgba(9,10,15,0.08)] ring-1 ring-hairline"
                                  : "text-muted hover:text-ink"
                              }`}
                            >
                              <span className="font-mono text-[10px] text-muted">0{i + 1}</span>
                              <Icon size={12} className={active ? "text-signal" : ""} aria-hidden="true" />
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      <div key={demoActiveTab} role="tabpanel" className="animate-tab-enter mt-4 flex-1 space-y-2 text-xs">
                        {demoActiveTab === "modules" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Module Agent found 2 core modules</p>
                            {[
                              { t: "Authentication & Session", s: "Protected", tone: "text-verified", d: "Validates user login, credentials, token persistence, and route guards." },
                              { t: "Invoice & Billing Engine", s: "Critical path", tone: "text-signal", d: "Calculates line item sums, promo discounts, subtotal recalculation, and payment gateway trigger." },
                            ].map((m) => (
                              <div key={m.t} className="rounded-lg border border-hairline p-3">
                                <div className="mb-1 flex items-center justify-between gap-2">
                                  <span className="truncate text-[13px] font-medium text-ink">{m.t}</span>
                                  <Tag tone={m.tone}>{m.s}</Tag>
                                </div>
                                <p className="text-[12px] leading-relaxed text-muted">{m.d}</p>
                              </div>
                            ))}
                          </>
                        )}

                        {demoActiveTab === "checklist" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Checklist Agent drafted 4 exploratory checks</p>
                            {[
                              "Verify subtotal recalculates instantly when discount code is applied",
                              "Attempt submitting invoice with negative or non-numeric line item quantity",
                              "Validate client details auto-complete on dropdown select",
                              "Confirm payment gateway timeout handles fallback state gracefully",
                            ].map((item) => (
                              <div key={item} className="flex items-start gap-2.5 rounded-lg border border-hairline p-2.5">
                                <CheckCircle2 size={14} className="mt-px shrink-0 text-verified" aria-hidden="true" />
                                <span className="text-[12px] leading-relaxed text-ink">{item}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {demoActiveTab === "testcases" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Test Case Agent wrote execution-ready steps</p>
                            <div className="space-y-2 rounded-lg border border-hairline p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-[12px] font-medium text-signal">TC-0102 · Apply promo code</span>
                                <Tag tone="text-verified">Passed</Tag>
                              </div>
                              <p className="text-[12px] leading-relaxed text-muted">
                                <span className="font-medium text-ink">Steps</span> 1. Open Invoice → 2. Enter $100 → 3. Type 'SAVE20' in promo field → 4. Click Apply
                              </p>
                              <p className="text-[12px] leading-relaxed text-muted">
                                <span className="font-medium text-ink">Expected</span> Subtotal updates to $80.00 without page refresh.
                              </p>
                            </div>
                          </>
                        )}

                        {demoActiveTab === "issues" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Issue Agent triaged 1 defect</p>
                            <div className="space-y-2 rounded-lg border border-hairline p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-medium text-ink">BUG-402 · Invalid promo freezes payment</span>
                                <Tag tone="text-flagged">High</Tag>
                              </div>
                              <p className="text-[12px] leading-relaxed text-muted">
                                <span className="font-medium text-ink">Actual</span> Unhandled Promise rejection when promo API returns 404.
                              </p>
                              <p className="text-[12px] leading-relaxed text-muted">
                                <span className="font-medium text-ink">Fix</span> Wrap discount endpoint in try/catch and dispatch a notification toast.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Motion cards ─────────────────────────────────────────────────── */}
        <section className="border-t border-hairline py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="See it work" title="From a sentence to a" accent="test suite.">
              Every step below is what BugMind does with a single workflow description.
            </SectionHeading>

            <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {[
                { label: "01 · modules", title: "Understands the flow", description: "Splits a workflow into modules and critical paths.", Scene: WorkflowScene },
                { label: "02 · checklist", title: "Plans exploration", description: "Drafts boundary, negative and UX checks.", Scene: ChecklistScene },
                { label: "03 · test cases", title: "Writes the cases", description: "Execution-ready steps land in the grid.", Scene: TestCaseScene },
                { label: "04 · issues", title: "Triages defects", description: "Classifies severity and links root cause.", Scene: TriageScene },
              ].map(({ label, title, description, Scene }, i) => (
                <div key={label} className="reveal w-[82%] shrink-0 snap-center xs:w-[70%] sm:w-auto" style={{ "--d": `${i * 90}ms` }}>
                  <MotionCard label={label} title={title} description={description} steps={Scene.steps} compact>
                    {(step) => <Scene step={step} />}
                  </MotionCard>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pipeline ─────────────────────────────────────────────────────── */}
        <section id="pipeline" className="scroll-mt-24 border-t border-hairline bg-surface py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-start lg:gap-16">
              <div className="lg:sticky lg:top-28 lg:col-span-5">
                <SectionHeading eyebrow="The pipeline" title="Four specialized agents," accent="in sequence." align="left">
                  Each agent works on the previous one's output, so coverage builds up from
                  modules to checks to cases to defects.
                </SectionHeading>

                <ol className="reveal mt-10 border-l border-hairline" style={{ "--d": "100ms" }}>
                  {AGENT_STEPS.map((s, idx) => {
                    const active = activeAgentIndex === idx;
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setActiveAgentIndex(idx)}
                          aria-current={active ? "step" : undefined}
                          className={`group relative -ml-px flex w-full items-center gap-4 border-l-2 py-3.5 pl-5 pr-2 text-left transition-colors duration-200 ${
                            active ? "border-signal" : "border-transparent hover:border-hairline-strong"
                          }`}
                        >
                          <span className={`font-mono text-[12px] ${active ? "text-signal" : "text-muted"}`}>0{s.id}</span>
                          <span className="min-w-0 flex-1">
                            <span className={`block text-[15px] font-medium transition-colors ${active ? "text-ink" : "text-muted group-hover:text-ink"}`}>
                              {s.agent}
                            </span>
                            <span className="block text-[13px] text-muted">{s.role}</span>
                          </span>
                          <ChevronRight
                            size={15}
                            aria-hidden="true"
                            className={`shrink-0 transition-all duration-200 ${active ? "translate-x-0 text-signal opacity-100" : "-translate-x-1 text-muted opacity-0 group-hover:opacity-100"}`}
                          />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="reveal lg:col-span-7" style={{ "--d": "150ms" }}>
                <div key={step.id} className="animate-tab-enter rounded-2xl border border-hairline bg-paper p-2">
                  <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                          <step.icon size={18} aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{step.agent}</h3>
                          <p className="text-[13px] text-muted">{step.role}</p>
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-muted">
                        0{step.id} / 04
                      </span>
                    </div>

                    <p className="mt-5 text-[14px] leading-relaxed text-muted">{step.desc}</p>

                    <div className="mt-6">
                      <p className="eyebrow mb-3">{step.codePreview.type}</p>
                      <ul className="divide-y divide-hairline rounded-lg border border-hairline">
                        {step.codePreview.items.map((item, i) => (
                          <li key={item.name} className="flex items-center justify-between gap-3 px-3.5 py-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="font-mono text-[11px] text-muted">0{i + 1}</span>
                              <span className="truncate text-[13px] text-ink">{item.name}</span>
                            </div>
                            <div className="hidden shrink-0 items-center gap-1.5 xs:flex">
                              <Tag>{item.badge}</Tag>
                              <Tag tone="text-verified">{item.status}</Tag>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Workspace ────────────────────────────────────────────────────── */}
        <section id="workspace" className="scroll-mt-24 border-t border-hairline py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="The workspace" title="Test cases with" accent="spreadsheet control.">
              Execute cases, edit preconditions and tag custom fields inline — built on AG Grid
              so large suites stay responsive.
            </SectionHeading>

            <div className="mt-10 sm:mt-14 grid gap-6 lg:grid-cols-5">
              {/* Active case */}
              <div className="reveal relative lg:col-span-2">
                <div aria-hidden="true" className="absolute inset-x-4 -top-2 hidden h-full rounded-2xl border border-hairline bg-surface/60 sm:block" />
                <div
                  style={{
                    transform: isSwiping
                      ? `translate3d(${swipeDir === "right" ? 40 : -40}px, 0, 0)`
                      : "translate3d(0,0,0)",
                    opacity: isSwiping ? 0 : 1,
                    transition: "transform 0.24s var(--ease-out-expo), opacity 0.2s ease-out",
                  }}
                  className="relative flex h-full flex-col rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-raised)] sm:p-6"
                  aria-live="polite"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[12px] font-medium text-signal">{currentTest.id}</span>
                    <span className="text-[12px] text-muted">· {currentTest.module}</span>
                    <span className={`ml-auto font-mono text-[11px] font-medium ${STATUS_TONE[currentTest.status]}`}>
                      {currentTest.status}
                    </span>
                  </div>

                  <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                    {currentTest.title}
                  </h3>

                  <dl className="mt-5 flex-1 space-y-4 text-[13px]">
                    <div>
                      <dt className="eyebrow mb-1.5">Steps</dt>
                      <dd className="leading-relaxed text-ink">{currentTest.steps}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow mb-1.5">Expected</dt>
                      <dd className="leading-relaxed text-ink">{currentTest.expected}</dd>
                    </div>
                  </dl>

                  <div className="mt-6 border-t border-hairline pt-4">
                    <p className="mb-2.5 text-[12px] text-muted">
                      Mark result · case {activeStackIndex + 1} of {STACKED_TEST_CASES.length}
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { s: "Passed", icon: Check, cls: "hover:border-verified/40 hover:bg-verified-soft hover:text-verified" },
                        { s: "Failed", icon: XCircle, cls: "hover:border-flagged/40 hover:bg-flagged-soft hover:text-flagged" },
                        { s: "Ready", icon: Clock, cls: "hover:border-signal/40 hover:bg-signal-soft hover:text-signal" },
                      ].map(({ s, icon: Icon, cls }) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => triggerCardSwipe(s)}
                          className={`flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-hairline text-[12px] font-medium text-ink transition-colors active:translate-y-px ${cls}`}
                        >
                          <Icon size={13} aria-hidden="true" />
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid */}
              <div className="reveal overflow-hidden rounded-2xl border border-hairline bg-surface lg:col-span-3" style={{ "--d": "120ms" }}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
                  <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                    <FileSpreadsheet size={15} className="text-signal" aria-hidden="true" />
                    Execution grid
                  </span>
                  <span className="text-[12px] text-muted">Select a row to open it</span>
                </div>
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-hairline bg-paper text-muted">
                        <th scope="col" className="px-4 py-2.5 font-medium">ID</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Title</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                        <th scope="col" className="px-4 py-2.5 font-medium">Custom field</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline text-ink">
                      {STACKED_TEST_CASES.map((tc, idx) => {
                        const selected = activeStackIndex === idx;
                        return (
                          <tr
                            key={tc.id}
                            onClick={() => setActiveStackIndex(idx)}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setActiveStackIndex(idx))}
                            tabIndex={0}
                            aria-selected={selected}
                            className={`cursor-pointer transition-colors focus:outline-none focus-visible:bg-signal-soft ${
                              selected ? "bg-signal-soft/60" : "hover:bg-paper"
                            }`}
                          >
                            <td className={`whitespace-nowrap px-4 py-3 font-mono ${selected ? "text-signal" : "text-muted"}`}>{tc.id}</td>
                            <td className="max-w-[240px] truncate px-4 py-3">{tc.title}</td>
                            <td className={`px-4 py-3 font-mono text-[11px] font-medium ${STATUS_TONE[tc.status]}`}>{tc.status}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-muted">{tc.priority}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-muted">{tc.tag}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Teams ────────────────────────────────────────────────────────── */}
        <section id="collaboration" className="scroll-mt-24 border-t border-hairline bg-surface py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="For teams" title="Built for engineering" accent="organizations.">
              Manage projects under organizations and teams, with role-based access and your own AI keys.
            </SectionHeading>

            <div className="mt-10 sm:mt-14 grid border-y border-hairline sm:grid-cols-3 sm:divide-x sm:divide-hairline">
              {TEAM_FEATURES.map(({ icon: Icon, title, body }, i) => (
                <div
                  key={title}
                  className="reveal border-b border-hairline px-1 py-8 last:border-b-0 sm:border-b-0 sm:px-8 sm:py-10 sm:first:pl-0 sm:last:pr-0"
                  style={{ "--d": `${i * 90}ms` }}
                >
                  <Icon size={20} className="text-signal" aria-hidden="true" />
                  <h3 className="mt-5 text-[16px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-24 border-t border-hairline py-16 sm:py-28">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-12">
            <div className="lg:col-span-4">
              <SectionHeading eyebrow="FAQ" title="Questions," accent="answered." align="left">
                How BugMind fits into your testing workflow.
              </SectionHeading>
            </div>
            <div className="reveal lg:col-span-8" style={{ "--d": "100ms" }}>
              <div className="border-t border-hairline">
                {FAQS.map((f, i) => (
                  <FaqItem key={f.q} id={`faq-${i}`} question={f.q} answer={f.a} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Closing CTA ──────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-hairline bg-surface py-20 sm:py-28">
          <Orbs variant="cta" />
          <div className="reveal relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <h2 className="text-[1.875rem] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[2.75rem]">
              Your next release,{" "}
              <span className="text-signal">fully covered.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-muted">
              Paste a workflow and get modules, checklists and test cases in minutes.
            </p>
            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => navigate(primaryCta.to)}
                className="btn-primary group !min-h-11 !px-5 !text-[15px]"
              >
                {primaryCta.label}
                <ArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  );
}
