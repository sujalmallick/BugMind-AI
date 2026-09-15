import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Layers,
  Sparkles,
  ShieldCheck,
  FileSpreadsheet,
  Bug,
  Users,
  KeyRound,
  Zap,
  ChevronDown,
  ChevronUp,
  Globe,
  Terminal,
  PlayCircle,
  ListChecks,
  Code2,
  Database,
  Search,
  Filter,
  Check,
  XCircle,
  AlertTriangle,
  Clock,
  LayoutGrid,
  ChevronRight,
  User,
  LogOut,
  Folder,
  LayoutDashboard,
  Menu,
  X,
} from "lucide-react";


import { useAuth } from "../auth/AuthContext";
import { getAvatarUrl } from "../utils/avatarUrl";
import logo from "../assets/bugmind2.png";
import favicon from "../assets/favicon.png";
import AppFooter from "../components/layout/AppFooter";


// ── Shared Sharp Monospace Feature Badge ─────────────────────────────────────
function FeatureBadge({ index, icon: Icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-2xs">
      {index && (
        <span className="font-mono text-[11px] font-bold text-signal bg-paper border border-hairline px-1.5 py-0.5 rounded">
          {index}
        </span>
      )}
      {Icon && <Icon size={13} className="shrink-0 text-muted" />}
      <span className="font-sans font-medium text-ink/90">{label}</span>
    </div>
  );
}

// ── FAQ Item Component ──────────────────────────────────────────────────────
function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-hairline py-4 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-4 text-left transition-colors hover:text-signal"
      >
        <span className="text-[15px] font-semibold text-ink">{question}</span>
        {open ? (
          <ChevronUp size={16} className="shrink-0 text-muted" />
        ) : (
          <ChevronDown size={16} className="shrink-0 text-muted" />
        )}
      </button>
      {open && (
        <p className="mt-2.5 text-[13px] leading-relaxed text-muted pr-6">
          {answer}
        </p>
      )}
    </div>
  );
}

// ── Pipeline Agent Step Data ─────────────────────────────────────────────────
const AGENT_STEPS = [
  {
    id: 1,
    agent: "Module Agent",
    role: "Domain Decomposition",
    icon: Layers,
    color: "text-signal bg-paper border border-hairline",
    desc: "Analyzes raw workflow descriptions and partitions them into clean domain boundaries, critical paths, and module hierarchy.",
    codePreview: {
      type: "Modules Generated",
      items: [
        { name: "Auth & Identity", status: "Protected", badge: "Core", tag: "3 routes" },
        { name: "Cart & Checkout Flow", status: "Critical Path", badge: "High Risk", tag: "5 actions" },
        { name: "Promo & Billing Engine", status: "Monetary", badge: "P0", tag: "4 endpoints" },
      ],
    },
  },
  {
    id: 2,
    agent: "Checklist Agent",
    role: "Exploratory Test Strategist",
    icon: ListChecks,
    color: "text-verified bg-paper border border-hairline",
    desc: "Synthesizes comprehensive exploratory testing checklists, boundary conditions, edge cases, and user experience checkpoints.",
    codePreview: {
      type: "Exploratory Checklist Items",
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
    role: "Manual Execution Writer",
    icon: FileSpreadsheet,
    color: "text-signal bg-paper border border-hairline",
    desc: "Transforms requirements into execution-ready manual test cases with preconditions, step-by-step actions, and expected results.",
    codePreview: {
      type: "Execution-Ready Test Cases",
      items: [
        { name: "TC-101: Apply valid 20% discount code at checkout", status: "Ready", badge: "High Priority" },
        { name: "TC-102: Handle 3D Secure bank verification timeout", status: "Ready", badge: "Critical" },
        { name: "TC-103: Persist cart items across browser tab reloads", status: "Ready", badge: "Medium" },
      ],
    },
  },
  {
    id: 4,
    agent: "Issue Agent",
    role: "Defect Analysis & Triage",
    icon: Bug,
    color: "text-flagged bg-paper border border-hairline",
    desc: "Ingests bug observations and failed executions to classify severity, map root causes, and write clean reproduction steps.",
    codePreview: {
      type: "Classified Defect Reports",
      items: [
        { name: "BUG-401: Invalid promo code freezes checkout CTA", status: "High Severity", badge: "API 404" },
        { name: "BUG-402: Cart total displays NaN on rapid currency switch", status: "Medium", badge: "State Desync" },
      ],
    },
  },
];

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
    statusBadge: "border border-hairline bg-surface text-verified font-mono",
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
    statusBadge: "border border-hairline bg-surface text-flagged font-mono",
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
    statusBadge: "border border-hairline bg-surface text-signal font-mono",
  },
  {
    id: "TC-0104",
    module: "Spreadsheet Grid",
    title: "Export 500+ Test Cases to XLSX with Custom Columns",
    status: "Passed",
    priority: "P1 High",
    steps: "1. Select all 500 rows → 2. Click Export to Excel → 3. Verify custom cf_ fields preserved",
    expected: "Downloaded .xlsx file matches grid column order and data types exactly.",
    tag: "cf_export_v2",
    statusBadge: "border border-hairline bg-surface text-verified font-mono",
  },
];


export default function LandingPage() {
  const navigate = useNavigate();
  const { authenticated, user, logout } = useAuth();

  // Mobile Menu & Screen Width State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );

  // Profile Menu Dropdown State
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const initials = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  // Scroll tracking for Parallax and Smart Instant Reveal Header
  const [scrollY, setScrollY] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const lastScrollY = useRef(0);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);

  // Stacked Card Swiping Interactive State
  const [activeStackIndex, setActiveStackIndex] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeDir, setSwipeDir] = useState("right");

  // Track window resizing for responsive behavior
  useEffect(() => {
    function handleResize() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const triggerCardSwipe = (targetStatus) => {
    if (isSwiping) return;
    setSwipeDir(targetStatus === "Failed" ? "left" : "right");
    setIsSwiping(true);
    setTimeout(() => {
      setActiveStackIndex((prev) => (prev + 1) % STACKED_TEST_CASES.length);
      setIsSwiping(false);
    }, 240);
  };

  // Interactive Live Demo States
  const [demoWorkflow, setDemoWorkflow] = useState(
    "User logs in → Navigates to Dashboard → Clicks 'Create Invoice' → Enters line items & client details → Applies 20% promo code → Submits payment"
  );
  const [demoActiveTab, setDemoActiveTab] = useState("modules");
  const [testGridFilter, setTestGridFilter] = useState("all");

  // Click-outside listener for profile dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleScroll() {
      const currentY = window.scrollY;
      setScrollY(currentY);
      setScrolled(currentY > 10);

      // Instant reveal on scroll UP, hide on scroll DOWN
      if (currentY <= 10) {
        setShowHeader(true);
      } else if (currentY < lastScrollY.current) {
        // Scrolling UP -> Reveal instantly
        setShowHeader(true);
      } else if (currentY > lastScrollY.current && currentY > 60) {
        // Scrolling DOWN -> Hide
        setShowHeader(false);
      }

      lastScrollY.current = currentY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Parallax offsets calculation for ambient orbs and hero card
  const orb1Translate = isMobile ? 0 : scrollY * 0.12;
  const orb2Translate = isMobile ? 0 : scrollY * -0.08;
  const orb3Translate = isMobile ? 0 : scrollY * 0.06;

  // First Hero Card Upward Glide (only enabled on desktop to avoid blocking touch targets on mobile)
  const heroRise = isMobile ? 0 : Math.max(-200, -scrollY * 0.35);
  const heroScale = isMobile ? 1 : Math.min(1.02, 0.985 + scrollY * 0.0001);
  const textFade = isMobile ? 1 : Math.max(0.15, 1 - scrollY * 0.002);
  const textParallax = isMobile ? 0 : scrollY * 0.1;

  return (
    <div className="relative min-h-screen bg-surface font-sans text-ink hero-glow projects-atmosphere overflow-x-clip max-w-full">


      
      {/* ── Parallax Floating Background Ambient Orbs ──────────────────────── */}
      <div
        style={{ transform: `translate3d(0, ${orb1Translate}px, 0)` }}
        className="workflow-orb-1 pointer-events-none fixed -left-28 top-16 h-[460px] w-[460px] rounded-full bg-signal/12 blur-[100px] z-0 transition-transform duration-75 ease-out"
      />
      <div
        style={{ transform: `translate3d(0, ${orb2Translate}px, 0)` }}
        className="workflow-orb-2 pointer-events-none fixed -right-28 top-1/3 h-[520px] w-[520px] rounded-full bg-blue-400/10 blur-[110px] z-0 transition-transform duration-75 ease-out"
      />
      <div
        style={{ transform: `translate3d(0, ${orb3Translate}px, 0)` }}
        className="workflow-orb-3 pointer-events-none fixed left-1/3 bottom-10 h-[400px] w-[400px] rounded-full bg-indigo-500/08 blur-[90px] z-0 transition-transform duration-75 ease-out"
      />

      {/* ── Sticky Top Navigation Bar with Instant Reveal on Scroll UP ──────── */}
      <header
        className={`
          sticky top-0 z-50 transition-all duration-200 ease-out
          ${showHeader ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}
          ${
            scrolled
              ? "border-b border-hairline bg-surface/95 backdrop-blur-xl shadow-sm"
              : "border-b border-hairline/80 bg-surface/90 backdrop-blur-md"
          }
        `}
      >


        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          
          {/* Logo */}
          <div
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" });
              navigate("/landing");
            }}
            className="flex cursor-pointer items-center gap-2 transition-opacity hover:opacity-85 shrink-0"
          >
            <img src={favicon} alt="" className="h-8 w-8 sm:h-9 sm:w-9 object-contain" />
            <img src={logo} alt="BugMind AI" className="h-[26px] sm:h-[32px] w-auto object-contain" />
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-6 md:flex text-[13px] font-medium text-muted">
            <a href="#pipeline" className="transition-colors hover:text-ink">AI Pipeline</a>
            <a href="#workspace" className="transition-colors hover:text-ink">Workspace & Grid</a>
            <a href="#collaboration" className="transition-colors hover:text-ink">Collaboration</a>
            <a href="#faq" className="transition-colors hover:text-ink">FAQ</a>
          </nav>

          {/* Auth Actions / Profile Menu */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {authenticated && user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="btn-shine inline-flex items-center gap-1 sm:gap-1.5 rounded-md border border-signal/20 bg-signal px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-signal/90 active:scale-[0.98]"
                >
                  <span className="hidden xs:inline">Open </span><span>Workspace</span>
                  <ArrowRight size={13} />
                </button>

                {/* Profile Avatar / Dropdown */}
                <div className="relative" ref={profileDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    aria-label="Open user menu"
                    className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-hairline bg-signal-soft font-mono text-xs font-bold text-signal transition-opacity hover:opacity-85 active:scale-95 overflow-hidden"
                  >
                    {user?.avatar_url ? (
                      <img
                        src={getAvatarUrl(user.avatar_url)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </button>

                  {profileDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-hairline bg-surface p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
                      <div className="border-b border-hairline px-3 py-2">
                        <p className="text-xs font-semibold text-ink truncate">{user.name || "User Profile"}</p>
                        <p className="font-mono text-[11px] text-muted truncate">{user.email}</p>
                      </div>

                      <div className="mt-1 space-y-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            navigate("/");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink hover:bg-paper transition-colors text-left"
                        >
                          <Folder size={14} className="text-muted" />
                          <span>Projects Hub</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            navigate("/dashboard");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink hover:bg-paper transition-colors text-left"
                        >
                          <LayoutDashboard size={14} className="text-muted" />
                          <span>Execution Dashboard</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            navigate("/profile");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-ink hover:bg-paper transition-colors text-left"
                        >
                          <User size={14} className="text-muted" />
                          <span>Profile & AI Settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setProfileDropdownOpen(false);
                            logout();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-flagged hover:bg-flagged-soft transition-colors text-left"
                        >
                          <LogOut size={14} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="rounded-md border border-hairline bg-surface px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-[13px] font-medium text-ink transition-colors hover:bg-paper active:scale-[0.98]"
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/register")}
                  className="btn-shine inline-flex items-center gap-1 sm:gap-1.5 rounded-md border border-signal/20 bg-signal px-2.5 sm:px-3.5 py-1.5 text-xs sm:text-[13px] font-semibold text-white shadow-sm transition-all hover:bg-signal/90 active:scale-[0.98]"
                >
                  <span className="hidden xs:inline">Get Started </span><span>Free</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}

            {/* Mobile Navigation Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              className="flex md:hidden items-center justify-center h-8 w-8 rounded-md border border-hairline bg-surface text-ink hover:bg-paper transition-colors active:scale-95 ml-1"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-hairline bg-surface/98 backdrop-blur-xl px-4 py-4 space-y-3 shadow-lg animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col space-y-2 text-sm font-medium text-ink">
              <a
                href="#pipeline"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-paper transition-colors"
              >
                <span>AI Pipeline</span>
                <ChevronRight size={14} className="text-muted" />
              </a>
              <a
                href="#workspace"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-paper transition-colors"
              >
                <span>Workspace & Spreadsheet</span>
                <ChevronRight size={14} className="text-muted" />
              </a>
              <a
                href="#collaboration"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-paper transition-colors"
              >
                <span>Collaboration & RBAC</span>
                <ChevronRight size={14} className="text-muted" />
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-paper transition-colors"
              >
                <span>FAQ</span>
                <ChevronRight size={14} className="text-muted" />
              </a>
            </nav>

            {!authenticated && (
              <div className="pt-2 border-t border-hairline flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/register");
                  }}
                  className="w-full justify-center btn-shine inline-flex items-center gap-1.5 rounded-md border border-signal/20 bg-signal py-2 text-sm font-semibold text-white shadow-sm"
                >
                  <span>Get Started Free</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/login");
                  }}
                  className="w-full justify-center rounded-md border border-hairline bg-paper py-2 text-sm font-medium text-ink"
                >
                  Sign In to Existing Account
                </button>
              </div>
            )}
          </div>
        )}
      </header>


      <main className="relative z-10">

        {/* ── Hero Section with Parallax Upward Glide & Glassmorphism ───────────────── */}
        <section className="relative border-b border-hairline py-10 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Hero Text Content (Layer z-10) */}
            <div
              style={{
                opacity: textFade,
                transform: `translate3d(0, ${textParallax}px, 0)`,
                transition: "opacity 0.08s ease-out, transform 0.08s ease-out",
              }}
              className="relative z-10 mx-auto max-w-3xl text-center"
            >
              {/* Pill badge with sharp mono token */}
              <div className="text-reveal-1 mb-4 inline-flex items-center gap-2 rounded-md border border-hairline bg-surface/90 backdrop-blur-md px-3 py-1 text-xs font-medium text-ink shadow-2xs">
                <span className="font-mono text-[11px] font-bold text-signal bg-paper border border-hairline px-1.5 py-0.5 rounded">01</span>
                <Sparkles size={13} className="text-signal" />
                <span className="text-ink/80 font-sans">AI Copilot for Exploratory QA & Test Generation</span>
              </div>


              {/* Main Headline with Shimmer */}
              <h1 className="text-reveal-2 text-2xl xs:text-3xl font-bold tracking-tight text-ink sm:text-4xl lg:text-5xl leading-tight sm:leading-tight">
                Turn Plain Text Workflows into <span className="text-shimmer">Execution-Ready QA</span>
              </h1>

              {/* Subtitle */}
              <p className="text-reveal-3 mt-4 text-sm sm:text-lg text-muted leading-relaxed max-w-2xl mx-auto px-1">
                Describe how your application works. BugMind's 4-agent AI pipeline automatically decomposes modules, generates exploratory checklists, writes manual test cases, and classifies bug reports.
              </p>

              {/* Action Buttons (Auth Aware) */}
              <div className="text-reveal-4 mt-6 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 w-full max-w-xs sm:max-w-none mx-auto">
                {authenticated && user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="btn-shine inline-flex items-center justify-center gap-2 rounded-md border border-signal/20 bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-signal/90 hover:shadow-lg active:scale-[0.98] w-full sm:w-auto"
                    >
                      <span>Go to Projects Workspace</span>
                      <ArrowRight size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/profile")}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface/90 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper active:scale-[0.98] w-full sm:w-auto"
                    >
                      <User size={15} />
                      <span>Account & Settings</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate("/register")}
                      className="btn-shine inline-flex items-center justify-center gap-2 rounded-md border border-signal/20 bg-signal px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-signal/90 hover:shadow-lg active:scale-[0.98] w-full sm:w-auto"
                    >
                      <span>Start Testing Free</span>
                      <ArrowRight size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate("/login")}
                      className="inline-flex items-center justify-center gap-2 rounded-md border border-hairline bg-surface/90 backdrop-blur-md px-5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-paper active:scale-[0.98] w-full sm:w-auto"
                    >
                      <span>Sign In to Workspace</span>
                    </button>
                  </>
                )}
              </div>

              <p className="text-reveal-5 mt-4 font-mono text-[11px] text-muted">
                {authenticated && user ? (
                  <span>Signed in as <strong className="text-ink">{user.email}</strong> • Active workspace ready</span>
                ) : (
                  <span>No credit card required • Bring your own API key (BYOK) supported</span>
                )}
              </p>
            </div>


            {/* ── Interactive Upward-Rising Product Simulator Mockup (Layer z-20) ──────────────── */}
            <div
              style={{
                transform: `translate3d(0, ${heroRise}px, 0) scale(${heroScale})`,
                transition: "transform 0.08s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="relative z-20 mt-8 sm:mt-14 mx-auto max-w-5xl rounded-2xl border border-hairline/90 bg-surface/95 backdrop-blur-2xl p-3.5 sm:p-6 shadow-2xl"
            >
              {/* Window Header */}
              <div className="flex items-center justify-between border-b border-hairline pb-3 sm:pb-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-400/80 shrink-0" />
                  <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-amber-400/80 shrink-0" />
                  <div className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-emerald-400/80 shrink-0" />
                  <span className="font-mono text-[11px] sm:text-xs font-semibold text-muted ml-1.5 truncate max-w-[130px] xs:max-w-[200px] sm:max-w-none">
                    bugmind_workflow_pipeline.py
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted font-mono shrink-0 ml-2">
                  <span className="inline-block h-2 w-2 rounded-full bg-verified animate-pulse" />
                  <span>AI Agents Synced</span>
                </div>
              </div>

              {/* Interactive Split Grid */}
              <div className="grid gap-6 lg:grid-cols-12">

                {/* Left: Interactive Input Flow */}
                <div className="lg:col-span-5 flex flex-col">
                  <label className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted flex items-center justify-between">
                    <span>1. Describe User Flow</span>
                    <span className="font-mono text-[10px] text-signal font-normal">Plain Text Input</span>
                  </label>

                  <textarea
                    value={demoWorkflow}
                    onChange={(e) => setDemoWorkflow(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-lg border border-hairline bg-paper/80 backdrop-blur-sm p-3 text-xs font-mono text-ink placeholder:text-muted focus:border-signal focus:outline-none transition-colors"
                    placeholder="Describe user flow..."
                  />

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted">Switch tabs on right to inspect agent outputs</span>
                    <div className="inline-flex items-center gap-1.5 rounded border border-hairline bg-surface px-2.5 py-1 text-xs font-mono font-medium text-signal shadow-2xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal animate-pulse" />
                      <span>Pipeline Active</span>
                    </div>
                  </div>
                </div>

                {/* Right: Translucent Agent Output Simulator */}
                <div className="lg:col-span-7 flex flex-col rounded-lg border border-hairline bg-paper/60 backdrop-blur-md p-3 sm:p-4">
                  <div className="flex items-center gap-1 border-b border-hairline pb-3 mb-3 overflow-x-auto scrollbar-none">
                    {[
                      { id: "modules", label: "01 Modules", icon: Layers },
                      { id: "checklist", label: "02 Checklist", icon: ListChecks },
                      { id: "testcases", label: "03 Test Cases", icon: FileSpreadsheet },
                      { id: "issues", label: "04 Issues", icon: Bug },
                    ].map((tab) => {
                      const Icon = tab.icon;
                      const active = demoActiveTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setDemoActiveTab(tab.id)}
                          className={`shrink-0 flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono transition-all duration-150 ${
                            active
                              ? "bg-surface text-signal shadow-xs border border-hairline font-semibold scale-[1.02]"
                              : "text-muted hover:text-ink hover:bg-surface/50"
                          }`}
                        >
                          <Icon size={13} />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Output Panels */}
                  <div className="flex-1 text-xs space-y-2">
                    {demoActiveTab === "modules" && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <p className="font-mono text-[11px] text-muted mb-2">Module Agent decomposed 3 core application modules:</p>
                        <div className="rounded-lg border border-hairline bg-surface/90 p-2.5 shadow-2xs hover:border-signal/30 transition-colors">
                          <div className="flex justify-between font-semibold text-ink mb-1">
                            <span>Authentication & Session</span>
                            <span className="font-mono text-[10px] font-semibold text-verified border border-hairline bg-surface px-1.5 py-0.5 rounded shadow-2xs">Protected</span>
                          </div>
                          <p className="text-muted text-[11px]">Validates user login, credentials, token persistence, and route guards.</p>
                        </div>
                        <div className="rounded-lg border border-hairline bg-surface/90 p-2.5 shadow-2xs hover:border-signal/30 transition-colors">
                          <div className="flex justify-between font-semibold text-ink mb-1">
                            <span>Invoice & Billing Engine</span>
                            <span className="font-mono text-[10px] font-semibold text-signal border border-hairline bg-surface px-1.5 py-0.5 rounded shadow-2xs">Critical Path</span>
                          </div>
                          <p className="text-muted text-[11px]">Calculates line item sums, promo discounts, subtotal recalculation, and payment gateway trigger.</p>
                        </div>
                      </div>
                    )}

                    {demoActiveTab === "checklist" && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <p className="font-mono text-[11px] text-muted mb-2">Checklist Agent generated exploratory test points:</p>
                        {[
                          "Verify subtotal recalculates instantly when discount code is applied",
                          "Attempt submitting invoice with negative or non-numeric line item quantity",
                          "Validate client details auto-complete on dropdown select",
                          "Confirm payment gateway timeout handles fallback state gracefully",
                        ].map((item, idx) => (
                          <div key={idx} className="flex items-start gap-2 rounded-lg border border-hairline bg-surface/90 p-2 text-ink shadow-2xs">
                            <CheckCircle2 size={14} className="text-verified shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {demoActiveTab === "testcases" && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <p className="font-mono text-[11px] text-muted mb-2">Test Case Agent generated execution-ready steps:</p>
                        <div className="rounded-lg border border-hairline bg-surface/90 p-2.5 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className="font-semibold text-signal">TC-0102: Apply Promo Code to Line Items</span>
                            <span className="rounded border border-hairline bg-surface px-1.5 py-0.5 text-verified font-mono text-[10px] font-semibold shadow-2xs">Passed</span>
                          </div>
                          <p className="text-muted text-[11px]"><strong>Steps:</strong> 1. Open Invoice modal → 2. Enter $100 line item → 3. Type 'SAVE20' in discount field → 4. Click Apply</p>
                          <p className="text-muted text-[11px]"><strong>Expected:</strong> Subtotal updates to $80.00 without page refresh.</p>
                        </div>
                      </div>
                    )}

                    {demoActiveTab === "issues" && (
                      <div className="space-y-2 animate-in fade-in duration-200">
                        <p className="font-mono text-[11px] text-muted mb-2">Issue Agent triaged defect analysis:</p>
                        <div className="rounded-lg border border-hairline bg-surface/90 p-2.5 shadow-2xs">
                          <div className="flex items-center justify-between font-semibold text-flagged mb-1">
                            <span>BUG-402: Invalid Promo Code Freezes Payment Button</span>
                            <span className="font-mono text-[10px] font-semibold text-flagged border border-hairline bg-surface px-1.5 py-0.5 rounded shadow-2xs">High Severity</span>
                          </div>
                          <p className="text-muted text-[11px]"><strong>Actual:</strong> Unhandled Promise rejection when promo API returns 404 status.</p>
                          <p className="text-muted text-[11px]"><strong>Fix:</strong> Wrap discount endpoint in try/catch and dispatch notification toast.</p>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* ── Sticky / Pinned 4-Agent Pipeline Inspector Section ─────────────── */}
        <section id="pipeline" className="relative border-b border-hairline py-12 sm:py-16 bg-surface">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            
            <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
              
              {/* Sticky Left Column: Large Heading & Step Controller */}
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <FeatureBadge index="02" icon={Cpu} label="Multi-Agent Pipeline" />
                
                <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl leading-tight">
                  4 Specialized AI Agents, Synchronized
                </h2>

                
                <p className="mt-2.5 text-sm text-muted leading-relaxed">
                  Scroll or click through the pipeline. Each agent processes functional flow logic sequentially to ensure complete testing coverage without hallucination.
                </p>

                {/* Step Navigation Pill Triggers */}
                <div className="mt-6 space-y-2">
                  {AGENT_STEPS.map((step, idx) => {
                    const active = activeAgentIndex === idx;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => setActiveAgentIndex(idx)}
                        className={`group flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all duration-150 ${
                          active
                            ? "border-signal/40 bg-surface shadow-xs"
                            : "border-hairline bg-surface/80 hover:bg-surface hover:border-ink/20 opacity-80 hover:opacity-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold transition-colors ${
                              active
                                ? "bg-signal text-white shadow-2xs"
                                : "border border-hairline bg-paper text-muted group-hover:text-ink group-hover:border-ink/20"
                            }`}
                          >
                            0{step.id}
                          </div>
                          <div>
                            <p className={`text-[13px] font-semibold transition-colors ${active ? "text-signal" : "text-ink"}`}>
                              {step.agent}
                            </p>
                            <p className="font-mono text-[11px] text-muted">{step.role}</p>
                          </div>
                        </div>
                        <ChevronRight
                          size={15}
                          className={`text-muted transition-transform ${active ? "translate-x-1 text-signal" : "group-hover:translate-x-0.5"}`}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Animated Transforming Agent Inspector Card */}
              <div className="lg:col-span-7">
                {AGENT_STEPS.map((step, idx) => {
                  const active = activeAgentIndex === idx;

                  if (!active) return null;

                  return (
                    <div
                      key={step.id}
                      className="rounded-2xl border border-hairline/90 bg-surface/95 backdrop-blur-xl p-4 sm:p-7 shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95"
                    >
                      <div className="flex flex-wrap xs:flex-nowrap items-center justify-between gap-2 border-b border-hairline pb-3.5 mb-4">
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-signal font-mono text-xs font-bold text-white shadow-2xs shrink-0">
                            0{step.id}
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-ink">{step.agent}</h3>
                            <p className="font-mono text-[11px] sm:text-xs text-muted">{step.role}</p>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] sm:text-xs font-semibold text-muted bg-paper border border-hairline px-2 sm:px-2.5 py-1 rounded-md shrink-0">
                          Phase 0{step.id} of 04
                        </span>
                      </div>


                      <p className="text-xs sm:text-sm text-muted leading-relaxed mb-4">{step.desc}</p>

                      {/* Live Output Preview Items */}
                      <div className="rounded-xl border border-hairline bg-paper/80 p-3 sm:p-3.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 flex items-center justify-between">
                          <span>{step.codePreview.type}</span>
                          <span className="font-mono text-[10px] text-verified">Live Pipeline Stream</span>
                        </p>

                        <div className="space-y-2">
                          {step.codePreview.items.map((item, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between gap-2 rounded-lg border border-hairline bg-surface p-2 sm:p-2.5 shadow-2xs hover:border-signal/40 transition-all hover:scale-[1.01]"
                            >
                              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-hairline bg-paper font-mono text-[10px] font-bold text-ink">
                                  0{i + 1}
                                </span>
                                <span className="text-xs font-medium text-ink truncate">{item.name}</span>
                              </div>

                              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-1.5 sm:ml-3">
                                <span className="rounded bg-paper border border-hairline px-1.5 sm:px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-medium text-muted">
                                  {item.badge}
                                </span>
                                <span className="rounded border border-hairline bg-surface px-1.5 sm:px-2 py-0.5 font-mono text-[9px] sm:text-[10px] font-semibold text-verified shadow-2xs">
                                  {item.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>

            </div>

          </div>
        </section>

        {/* ── Floating & Stacked Test Case Cards / Workspace Grid ────────────── */}
        <section id="workspace" className="relative border-b border-hairline py-12 sm:py-16 bg-paper/40">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            
            <div className="text-center max-w-2xl mx-auto mb-10">
              <FeatureBadge index="03" icon={FileSpreadsheet} label="High-Density Execution Grid" />
              <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                Stacked Test Cases with Full Spreadsheet Control
              </h2>

              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Execute test cases, edit preconditions, and tag custom fields inline. Built with AG Grid for sub-millisecond responsiveness.
              </p>
            </div>

            {/* Stacked Interactive Swiping Cards Deck with Depth */}
            <div className="relative mx-auto max-w-5xl mb-8">

              {/* Layer 1: Bottom Card in Stack */}
              <div className="hidden sm:block absolute -top-5 left-4 right-4 h-52 rounded-2xl border border-hairline/60 bg-surface/60 backdrop-blur-sm -rotate-2 scale-[0.94] shadow-sm pointer-events-none transition-all duration-300" />

              {/* Layer 2: Middle Card in Stack */}
              <div className="hidden sm:block absolute -top-2.5 left-2 right-2 h-52 rounded-2xl border border-hairline/70 bg-surface/75 backdrop-blur-md rotate-1 scale-[0.97] shadow-md pointer-events-none transition-all duration-300" />

              {/* Layer 3: Top Foreground Swiping Card */}
              {(() => {
                const currentTest = STACKED_TEST_CASES[activeStackIndex];
                return (
                  <div
                    style={{
                      transform: isSwiping
                        ? swipeDir === "right"
                          ? "translate3d(120px, -12px, 0) rotate(8deg) scale(0.95)"
                          : "translate3d(-120px, -12px, 0) rotate(-8deg) scale(0.95)"
                        : "translate3d(0, 0, 0) rotate(0deg) scale(1)",
                      opacity: isSwiping ? 0 : 1,
                      transition: "transform 0.24s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease-out",
                    }}
                    className="relative z-10 rounded-2xl border border-hairline bg-surface/95 backdrop-blur-xl p-4 sm:p-7 shadow-xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-hairline pb-3 sm:pb-4 mb-3 sm:mb-4">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
                        <span className="font-mono text-xs font-bold text-ink bg-paper border border-hairline px-2 py-0.5 rounded shadow-2xs">
                          {currentTest.id}
                        </span>
                        <span className="font-mono text-xs text-muted">
                          {currentTest.module}
                        </span>
                        <span className="font-mono text-[10px] text-muted border border-hairline px-2 py-0.5 rounded bg-paper">
                          {currentTest.tag}
                        </span>
                      </div>

                      {/* Interactive Swiping Status Triggers with Sharp Badges */}
                      <div className="flex items-center gap-1.5 font-mono text-[11px] w-full sm:w-auto justify-between sm:justify-start">
                        <span className="text-muted text-[10px] mr-1 hidden sm:inline">Click to swipe:</span>
                        <button
                          type="button"
                          onClick={() => triggerCardSwipe("Passed")}
                          className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1 text-xs font-mono font-medium text-verified transition-colors hover:bg-verified hover:text-white active:scale-95 shadow-2xs"
                        >
                          <Check size={12} />
                          <span>Passed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerCardSwipe("Failed")}
                          className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1 text-xs font-mono font-medium text-flagged transition-colors hover:bg-flagged hover:text-white active:scale-95 shadow-2xs"
                        >
                          <XCircle size={12} />
                          <span>Failed</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => triggerCardSwipe("Ready")}
                          className="flex-1 sm:flex-initial justify-center flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2.5 py-1 text-xs font-mono font-medium text-signal transition-colors hover:bg-signal hover:text-white active:scale-95 shadow-2xs"
                        >
                          <Clock size={12} />
                          <span>Ready</span>
                        </button>
                      </div>

                    </div>

                    <h3 className="text-base sm:text-lg font-bold text-ink mb-3">
                      {currentTest.title}
                    </h3>

                    <div className="grid gap-3 sm:grid-cols-2 text-xs mb-4">
                      <div className="rounded-lg border border-hairline bg-paper/80 p-3">
                        <p className="font-semibold text-muted text-[10px] uppercase tracking-wider mb-1">Execution Steps</p>
                        <p className="text-ink font-mono text-[11px] leading-relaxed">{currentTest.steps}</p>
                      </div>
                      <div className="rounded-lg border border-hairline bg-paper/80 p-3">
                        <p className="font-semibold text-muted text-[10px] uppercase tracking-wider mb-1">Expected Outcome</p>
                        <p className="text-ink font-mono text-[11px] leading-relaxed">{currentTest.expected}</p>
                      </div>
                    </div>

                    <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2 border-t border-hairline pt-3 text-[11px] text-muted">
                      <span className="font-mono">Card {activeStackIndex + 1} of {STACKED_TEST_CASES.length} in active deck</span>
                      <button
                        type="button"
                        onClick={() => triggerCardSwipe("next")}
                        className="inline-flex items-center gap-1 text-signal font-semibold hover:underline"
                      >
                        <span>Swipe to next card</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* High-Density AG Grid Table View */}
            <div className="relative rounded-2xl border border-hairline bg-surface/90 backdrop-blur-xl p-3.5 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-3 mb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FileSpreadsheet size={16} className="text-signal shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-ink">Spreadsheet Execution Grid (Live Sync)</span>
                  <span className="font-mono text-[10px] text-muted bg-paper border border-hairline px-2 py-0.5 rounded">
                    AG Grid Community
                  </span>
                </div>
                <span className="font-mono text-[10px] sm:text-[11px] text-muted">Double-click cells for inline editing</span>
              </div>

              <div className="overflow-x-auto -mx-1 sm:mx-0">
                <table className="w-full min-w-[580px] text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-hairline bg-paper text-muted">
                      <th className="p-2 font-semibold">Test ID</th>
                      <th className="p-2 font-semibold">Module</th>
                      <th className="p-2 font-semibold">Title</th>
                      <th className="p-2 font-semibold">Status</th>
                      <th className="p-2 font-semibold">Priority</th>
                      <th className="p-2 font-semibold">Custom Field (cf_)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline text-ink">
                    {STACKED_TEST_CASES.map((tc, idx) => (
                      <tr
                        key={tc.id}
                        onClick={() => setActiveStackIndex(idx)}
                        className={`cursor-pointer transition-colors ${
                          activeStackIndex === idx ? "bg-signal-soft/40 font-semibold" : "hover:bg-paper/80"
                        }`}
                      >
                        <td className="p-2 text-signal">{tc.id}</td>
                        <td className="p-2">{tc.module}</td>
                        <td className="p-2 font-sans text-xs max-w-xs truncate">{tc.title}</td>
                        <td className="p-2">
                          <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${tc.statusBadge}`}>
                            {tc.status}
                          </span>
                        </td>
                        <td className="p-2 font-sans text-xs">{tc.priority}</td>
                        <td className="p-2 text-muted">{tc.tag}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[10px] text-muted sm:hidden font-mono text-center">
                ← Swipe horizontally to view full spreadsheet columns →
              </p>
            </div>


          </div>
        </section>

        {/* ── Horizontal/Diagonal Slide Cards: Team & BYOK ──────────────────── */}
        <section id="collaboration" className="relative border-b border-hairline py-12 sm:py-16 bg-surface">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <FeatureBadge index="04" icon={Users} label="Collaborative QA Hub" />
              <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">

                Built for Agile Engineering Organizations
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                Manage multiple projects under central Organizations and Teams with role-based access control and BYOK API keys.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="rounded-2xl border border-hairline bg-surface/90 backdrop-blur-md p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-paper text-ink mb-4 shadow-2xs">
                  <Users size={16} />
                </div>
                <h3 className="text-base font-bold text-ink">Organizations & Teams</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Group projects under central organizations. Invite team members with roles (Owner, Admin, Member, Viewer).
                </p>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface/90 backdrop-blur-md p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-paper text-ink mb-4 shadow-2xs">
                  <ShieldCheck size={16} />
                </div>
                <h3 className="text-base font-bold text-ink">Role-Based Access</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Control who can edit test cases, re-analyze workflows, manage API keys, or delete project data safely.
                </p>
              </div>

              <div className="rounded-2xl border border-hairline bg-surface/90 backdrop-blur-md p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline bg-paper text-ink mb-4 shadow-2xs">
                  <KeyRound size={16} />
                </div>
                <h3 className="text-base font-bold text-ink">BYOK API Key Support</h3>
                <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                  Connect your own Google Gemini or OpenAI API keys directly for complete control over AI provider quotas.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ── FAQ Section ──────────────────────────────────────────────────── */}
        <section id="faq" className="relative border-b border-hairline py-12 sm:py-16 bg-paper/40">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                Frequently Asked Questions
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-muted">
                Everything you need to know about BugMind AI and how it fits your testing workflow.
              </p>
            </div>

            <div className="rounded-2xl border border-hairline bg-surface/90 backdrop-blur-md p-6 sm:p-8 shadow-sm">

              <FaqItem
                question="What input does BugMind AI need to generate test cases?"
                answer="BugMind accepts plain text descriptions of your application's user flows, feature specifications, or user stories. You don't need to write code, scripts, or formal syntax."
              />

              <FaqItem
                question="Does BugMind AI scan repository code or run CI/CD bots?"
                answer="No. BugMind is a QA workflow and test management tool designed for QA engineers, product managers, and developers. It generates structured test plans and manages execution directly from functional workflow descriptions — it does not analyze source code or run AST parsing."
              />

              <FaqItem
                question="Can I import my existing spreadsheet test cases?"
                answer="Yes! BugMind includes a built-in CSV and Excel (.xlsx) importer that auto-detects column headers and maps them into your project's spreadsheet grid."
              />

              <FaqItem
                question="How does Bring Your Own Key (BYOK) work?"
                answer="You can enter your own API key (e.g., Google Gemini) in your account profile. BugMind uses your key directly for AI requests, keeping your usage separate and under your own provider quota."
              />

              <FaqItem
                question="Can team members collaborate on the same project?"
                answer="Yes. Projects can be created within Organizations or Teams. Multiple team members can view, edit, and track test case execution in real-time."
              />
            </div>
          </div>
        </section>

      </main>

      {/* Shared Application Footer */}
      <AppFooter />
    </div>
  );
}
