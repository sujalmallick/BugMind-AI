import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowRight,
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
  FileText,
  ClipboardList,
  Code2,
  Wand2,
  BellRing,
  Lock,
  Quote,
  Server,
  GitBranch,
  Upload,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";
import UserAvatar from "../components/common/UserAvatar";
import BrandMark from "../components/shared/BrandMark";
import Orbs from "../components/shared/Orbs";
import AppFooter from "../components/layout/AppFooter";
import useReveal from "../hooks/useReveal";
import {
  MotionCard,
  GroundedScene,
  PlanScene,
  PlaywrightScene,
  HealScene,
} from "../components/shared/MotionScenes";

const NAV_LINKS = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#automation", label: "Automation" },
  { href: "#workspace", label: "Workspace" },
  { href: "#collaboration", label: "Security" },
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
    agent: "Planning Agent",
    role: "Phased test planning",
    icon: ClipboardList,
    desc: "Proposes a test plan in phases. You approve or skip each phase, and only approved phases get test cases.",
    codePreview: {
      type: "Proposed test plan",
      items: [
        { name: "Phase 1: Happy-path checkout", status: "Approved", badge: "6 cases" },
        { name: "Phase 2: Promo & pricing rules", status: "Approved", badge: "8 cases" },
        { name: "Phase 3: Payment failures", status: "Proposed", badge: "5 cases" },
      ],
    },
  },
  {
    id: 4,
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
    id: 5,
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
  { id: "plan", label: "Plan", icon: ClipboardList },
  { id: "testcases", label: "Cases", icon: FileSpreadsheet },
  { id: "automation", label: "Playwright", icon: Code2 },
  { id: "issues", label: "Bugs", icon: Bug },
];

const DEMO_DOCS = ["checkout-spec.pdf", "promo-rules.md"];

const AUTOMATION_STEPS = [
  {
    icon: Server,
    title: "Add your app's URL",
    body: "Secrets stay encrypted.",
  },
  {
    icon: ListChecks,
    title: "Approve the steps",
    body: "Nothing runs without your OK.",
  },
  {
    icon: GitBranch,
    title: "Run it free on GitHub",
    body: "Download a ready Playwright project.",
  },
  {
    icon: Upload,
    title: "Upload the results",
    body: "Test cases update and your team is notified.",
  },
];

const AUTOMATION_FEATURES = [
  {
    icon: Wand2,
    title: "Self-healing locators",
    body: "Page changed? Get a fix to approve.",
  },
  {
    icon: Bug,
    title: "Failures become bugs",
    body: "One click, full bug report.",
  },
  {
    icon: BellRing,
    title: "Status sync",
    body: "Pass or fail lands on the test case.",
  },
];

const TEAM_FEATURES = [
  {
    icon: Users,
    title: "Organizations & teams",
    body: "Invite your team with clear roles.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Decide who can edit or delete.",
  },
  {
    icon: KeyRound,
    title: "Bring your own key",
    body: "Gemini, OpenAI, Anthropic, Groq and more.",
  },
  {
    icon: Quote,
    title: "Grounded answers",
    body: "Unsourced steps get flagged.",
  },
  {
    icon: FileText,
    title: "Private documents",
    body: "PDF, Word or Markdown. Private to the project.",
  },
  {
    icon: Lock,
    title: "Encrypted secrets",
    body: "Never shown, never sent to AI.",
  },
];

const FAQS = [
  {
    q: "What do I need to give BugMind?",
    a: "A short description of your app, or your spec documents (up to 20 per project).",
  },
  {
    q: "How do you avoid made-up test cases?",
    a: "Every step cites a source, and anything unsourced is flagged for you.",
  },
  {
    q: "Does BugMind run my tests?",
    a: "No. You run them free on GitHub, then upload the results.",
  },
  {
    q: "Does BugMind read my source code?",
    a: "No. Only your descriptions and documents.",
  },
  {
    q: "Can I import my existing spreadsheet test cases?",
    a: "Yes, from CSV or Excel.",
  },
  {
    q: "How does bring-your-own-key work?",
    a: "Add your key in Settings. Usage stays on your account.",
  },
  {
    q: "Can team members collaborate on the same project?",
    a: "Yes, through organizations and teams.",
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
    "Shopper adds items to the cart → Opens the cart → Applies promo code SAVE20 → Pays by card with 3-D Secure → Gets an email receipt"
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
                Plan · write · automate
              </p>

              <h1
                className="stagger mt-5 text-[2.375rem] font-semibold leading-[1.04] tracking-[-0.035em] text-ink xs:text-[2.75rem] sm:text-6xl lg:text-[4.5rem]"
                style={{ "--d": "80ms" }}
              >
                From specs to{" "}
                <span className="text-signal">
                  automated tests.
                </span>
              </h1>

              <p
                className="stagger mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-muted sm:mt-6 sm:text-lg"
                style={{ "--d": "160ms" }}
              >
                Attach your specs. Get a test plan, test cases and ready-to-run tests.
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
                  <>Free to start · Bring your own AI key</>
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
                      <span className="truncate font-mono text-[11px] text-muted">checkout_workflow.txt</span>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-verified" aria-hidden="true" />
                      Grounded in 2 docs
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
                      <div className="mt-3">
                        <p className="text-[11px] font-medium text-muted">Reference documents</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {DEMO_DOCS.map((d, i) => (
                            <span key={d} className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-paper px-2 py-1 text-[11px] text-ink">
                              <FileText size={12} className="text-signal" aria-hidden="true" />
                              {d}
                              <span className="font-mono text-[10px] text-muted">[{i + 1}]</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="mt-3 text-[12px] text-muted">
                        Switch tabs to see each step of the pipeline.
                      </p>
                    </div>

                    {/* Output */}
                    <div className="flex flex-col p-4 sm:p-5 lg:col-span-7 lg:min-h-[300px]">
                      <div
                        role="tablist"
                        aria-label="Agent outputs"
                        className="grid grid-cols-3 gap-1 rounded-lg bg-paper p-1 sm:grid-cols-5"
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
                              <span className="hidden font-mono text-[10px] text-muted xs:inline">0{i + 1}</span>
                              <Icon size={12} className={active ? "text-signal" : ""} aria-hidden="true" />
                              {tab.label}
                            </button>
                          );
                        })}
                      </div>

                      <div key={demoActiveTab} role="tabpanel" className="animate-tab-enter mt-4 flex-1 space-y-2 text-xs">
                        {demoActiveTab === "modules" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Module Agent found 2 core modules, cited from your docs</p>
                            {[
                              { t: "Cart & Promo Engine", s: "Critical path", tone: "text-signal", d: "Line totals, promo validation and subtotal recalculation before tax. [2]" },
                              { t: "Payments & 3-D Secure", s: "Protected", tone: "text-verified", d: "Card payment, bank verification and timeout handling. [1]" },
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

                        {demoActiveTab === "plan" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Planning Agent proposed 3 phases. Approve each one.</p>
                            {[
                              { n: "Happy-path checkout", c: 6, ok: true },
                              { n: "Promo & pricing rules", c: 8, ok: true },
                              { n: "Payment failures", c: 5, ok: false },
                            ].map((p, i) => (
                              <div key={p.n} className="flex items-center justify-between gap-2 rounded-lg border border-hairline p-2.5">
                                <span className="min-w-0">
                                  <span className="block font-mono text-[10px] text-muted">Phase {i + 1}</span>
                                  <span className="block truncate text-[12px] font-medium text-ink">{p.n}</span>
                                </span>
                                <Tag tone={p.ok ? "text-verified" : "text-muted"}>{p.ok ? `Approved · ${p.c} cases` : "Proposed"}</Tag>
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
                                <span className="font-medium text-ink">Steps</span> 1. Open a cart totalling $100 → 2. Type 'SAVE20' in the promo field → 3. Click Apply
                              </p>
                              <p className="text-[12px] leading-relaxed text-muted">
                                <span className="font-medium text-ink">Expected</span> Subtotal updates to $80.00 without page refresh.
                              </p>
                            </div>
                          </>
                        )}

                        {demoActiveTab === "automation" && (
                          <>
                            <p className="mb-2 text-[12px] text-muted">Approved script, exported as a Playwright test</p>
                            <pre className="overflow-x-auto rounded-lg border border-hairline bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">
{`test('[BM-12 v3] Apply promo code', async ({ page }) => {
  await page.goto(\`\${BASE_URL}/cart\`);
  await page.getByLabel('Promo code').fill('SAVE20');
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText('$80.00')).toBeVisible();
});`}
                            </pre>
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-hairline p-2.5">
                              <span className="truncate text-[12px] text-ink">bugmind-e2e.zip · GitHub Actions workflow included</span>
                              <Tag tone="text-signal">Export</Tag>
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
            <SectionHeading eyebrow="See it work" title="From your specs to" accent="running tests.">
              One workflow, two docs, four steps.
            </SectionHeading>

            <div className="no-scrollbar -mx-4 mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-10 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
              {[
                { label: "01 · documents", title: "Grounded in your specs", description: "Every step cites a source.", Scene: GroundedScene },
                { label: "02 · test plan", title: "Plans in phases", description: "Approve one phase at a time.", Scene: PlanScene },
                { label: "03 · playwright", title: "Exports real tests", description: "Ready-to-run Playwright code.", Scene: PlaywrightScene },
                { label: "04 · results", title: "Heals and files bugs", description: "Fixes locators, files bugs.", Scene: HealScene },
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
                <SectionHeading eyebrow="The pipeline" title="Five specialized agents," accent="in sequence." align="left">
                  Each one builds on the last. Every answer cites its source.
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
                        0{step.id} / 05
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

        {/* ── Automation ───────────────────────────────────────────────────── */}
        <section id="automation" className="scroll-mt-24 border-t border-hairline bg-surface py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
              <div className="lg:col-span-5">
                <SectionHeading eyebrow="Automation" title="Automated tests," accent="free on GitHub." align="left">
                  We write the Playwright tests. You run them on GitHub.
                </SectionHeading>

                <ol className="reveal mt-8 space-y-5" style={{ "--d": "100ms" }}>
                  {AUTOMATION_STEPS.map(({ icon: Icon, title, body }, i) => (
                    <li key={title} className="flex gap-3.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-signal-soft text-signal">
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[14px] font-medium text-ink">
                          <span className="mr-1.5 font-mono text-[11px] text-muted">0{i + 1}</span>
                          {title}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Example automation overview */}
              <div className="reveal lg:col-span-7" style={{ "--d": "150ms" }}>
                <div
                  role="img"
                  aria-label="Example automation overview: 87% pass rate over recent runs, with one failed test offering a locator fix and a bug report"
                  className="relative overflow-hidden rounded-2xl border border-hairline bg-paper p-3 sm:p-5"
                >
                  <Orbs variant="panel" className="opacity-70" />
                  <div className="glass relative rounded-xl p-4 sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[13px] font-semibold text-ink">Automation overview</p>
                      <span className="font-mono text-[11px] text-muted">Last run #12 · 2h ago</span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {[
                        { l: "Pass rate", v: "87%" },
                        { l: "Automated", v: "24 / 31" },
                        { l: "Failing", v: "2", tone: "text-flagged" },
                      ].map((m) => (
                        <div key={m.l} className="rounded-lg border border-hairline bg-surface px-3 py-2.5">
                          <p className="text-[11px] text-muted">{m.l}</p>
                          <p className={`mt-1 text-lg font-semibold tabular-nums ${m.tone || "text-ink"}`}>{m.v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 rounded-lg border border-hairline bg-surface p-3">
                      <p className="text-[11px] text-muted">Pass rate, last 8 runs</p>
                      <div className="mt-2 flex h-14 items-end gap-1.5">
                        {[62, 70, 68, 78, 74, 85, 82, 87].map((v, i) => (
                          <span key={i} className="flex-1 rounded-t bg-signal/80" style={{ height: `${v}%`, opacity: 0.45 + i * 0.07 }} />
                        ))}
                      </div>
                    </div>

                    <ul className="mt-4 divide-y divide-hairline rounded-lg border border-hairline bg-surface">
                      {[
                        { r: "#12", d: "18 passed · 2 failed", tone: "text-flagged", s: "fail" },
                        { r: "#11", d: "20 passed", tone: "text-verified", s: "pass" },
                        { r: "#10", d: "19 passed · 1 failed", tone: "text-flagged", s: "fail" },
                      ].map((run) => (
                        <li key={run.r} className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]">
                          <span className="font-mono text-muted">Run {run.r}</span>
                          <span className="flex-1 truncate text-ink">{run.d}</span>
                          <span className={`font-mono text-[11px] ${run.tone}`}>{run.s}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-flagged/20 bg-flagged-soft/60 px-3 py-2.5">
                      <span className="min-w-0 text-[12px] text-ink">
                        <span className="font-mono text-muted">TC-102</span> Apply promo code failed
                      </span>
                      <span className="flex gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-ink">
                          <Wand2 size={11} className="text-signal" aria-hidden="true" /> 1 locator fix
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-hairline bg-surface px-2 py-1 text-[11px] font-medium text-ink">
                          <Bug size={11} className="text-flagged" aria-hidden="true" /> Create bug
                        </span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-14 grid gap-4 sm:grid-cols-3">
              {AUTOMATION_FEATURES.map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="reveal rounded-xl border border-hairline p-5" style={{ "--d": `${i * 90}ms` }}>
                  <Icon size={18} className="text-signal" aria-hidden="true" />
                  <h3 className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Teams ────────────────────────────────────────────────────────── */}
        <section id="collaboration" className="scroll-mt-24 border-t border-hairline py-16 sm:py-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <SectionHeading eyebrow="Teams & security" title="Built for teams that" accent="ship safely.">
              Roles, private docs and your own AI key.
            </SectionHeading>

            <div className="mt-10 grid gap-x-10 gap-y-2 sm:mt-14 sm:grid-cols-2 lg:grid-cols-3">
              {TEAM_FEATURES.map(({ icon: Icon, title, body }, i) => (
                <div
                  key={title}
                  className="reveal border-t border-hairline py-7"
                  style={{ "--d": `${(i % 3) * 90}ms` }}
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
              Attach a spec. Ship tested.
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

      <AppFooter variant="full" />
    </div>
  );
}
