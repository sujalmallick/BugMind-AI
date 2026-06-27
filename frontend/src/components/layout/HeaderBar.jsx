import { useState } from "react";
import { Search, KeyRound, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../utils/time";
import { useAuth } from "../../auth/AuthContext";
import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";
import AISettingsModal from "../common/AISettingsModal";
import useToasts from "../shared/useToasts";
import ToastStack from "../shared/ToastStack";

export default function HeaderBar({
  connected = true,
  onOpenCommandPalette,
  projectName,
  updatedAt,
}) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const { toasts, showToast } = useToasts();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  const shortcut =
    navigator.platform.toUpperCase().includes("MAC")
      ? "⌘ K"
      : "Ctrl K";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-hairline/70 bg-white/90 shadow-sm backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-8 sm:py-4">

        {/* Left */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-4 md:gap-5">

          <div
            title="Go to Projects"
            onClick={() => navigate("/")}
            className="group flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
          >
            <img
              src={favicon}
              alt="BugMind"
              className="h-10 w-10 object-contain"
            />

            <img
              src={logo}
              alt="BugMind AI"
              className="h-11 w-auto object-contain"
            />
          </div>

          {projectName && (
            <>
              <div className="h-7 w-px bg-hairline" />

              <div className="min-w-0 max-w-[48vw] sm:max-w-none">
                <p className="truncate text-sm font-semibold text-ink sm:text-base">
                  {projectName}
                </p>

             <div className="mt-0.5 hidden items-center gap-1.5 text-xs text-muted sm:flex">
               <span className="h-2 w-2 rounded-full bg-emerald-500"></span>

               <span>
                 Updated {formatRelativeTime(updatedAt)}
               </span>
             </div>


              </div>
            </>
          )}

        </div>

        {/* Right */}
        <div className="flex items-center gap-2 text-[13px] text-muted sm:gap-3 md:gap-4">

          {/* AI Settings / BYOK Button */}
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            title="Configure AI Settings"
            className={`
              hidden items-center gap-2 rounded-lg border border-hairline px-2.5 py-2 text-[13px] font-semibold
              shadow-sm transition-colors duration-150 sm:px-3 md:inline-flex
              ${
                connected
                  ? "bg-surface text-ink hover:bg-paper hover:text-ink"
                  : "bg-flagged-soft/30 text-flagged hover:bg-flagged-soft"
              }
            `}
          >
            <KeyRound size={15} className={connected ? "text-muted" : "text-flagged"} />
            {connected ? "BYOK Settings" : "BYOK (Offline)"}
          </button>

          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-[13px] font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-signal hover:bg-paper hover:text-ink sm:px-3"
          >
            <Search size={15} />

            <span className="hidden md:inline">
              Search
            </span>

            <kbd className="hidden rounded-md border border-hairline bg-paper px-2 py-0.5 font-mono text-[11px] text-muted md:inline">
              {shortcut}
            </kbd>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            title="Logout"
            className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-2.5 py-2 text-[13px] font-semibold text-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-flagged hover:bg-flagged-soft hover:text-flagged sm:px-3"
          >
            <LogOut size={15} />
            <span className="hidden md:inline">Logout</span>
          </button>

        </div>

        </div>
      </header>

      {/* BYOK AI Settings Modal */}
      <AISettingsModal
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        onKeySaved={() => {
          setAiModalOpen(false);
          showToast("Key connected successfully!");
        }}
        onKeyDeleted={(provider) => {
          const label = provider.charAt(0).toUpperCase() + provider.slice(1);
          showToast(`${label} API key deleted.`);
        }}
      />
      
      {/* Toast notifications */}
      <ToastStack toasts={toasts} />
    </>
  );
}