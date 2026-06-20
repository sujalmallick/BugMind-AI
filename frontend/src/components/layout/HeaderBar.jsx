import { Search, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatRelativeTime } from "../../utils/time";
import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

export default function HeaderBar({
  connected = true,
  onOpenCommandPalette,
  projectName,
    updatedAt,
}) {
  const navigate = useNavigate();

  const shortcut =
    navigator.platform.toUpperCase().includes("MAC")
      ? "⌘ K"
      : "Ctrl K";

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-hairline bg-white px-6 py-4 shadow-sm">
      
      {/* Left */}
      <div className="flex items-center gap-5">

        <div
          title="Go to Projects"
          onClick={() => navigate("/")}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
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
            <div className="h-8 w-px bg-gray-200" />

            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">
                {projectName}
              </p>

              <p className="text-xs text-muted">
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>

  <span>
    Updated {formatRelativeTime(updatedAt)}
  </span>
</div>
              </p>
            </div>
          </>
        )}

      </div>

      {/* Right */}
      <div className="flex items-center gap-4 text-[13px] text-muted">

        <span className="flex items-center gap-2 rounded-full border border-hairline bg-paper px-3 py-1.5 text-[12px] font-medium">
          <Circle
            size={8}
            className={
              connected
                ? "fill-verified text-verified"
                : "fill-flagged text-flagged"
            }
          />

          {connected
            ? "Gemini 2.5 Flash connected"
            : "Backend unreachable"}
        </span>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] font-medium shadow-sm transition-all duration-200 hover:border-signal hover:bg-paper hover:text-ink"
        >
          <Search size={15} />

          <span className="hidden sm:inline">
            Search
          </span>

          <kbd className="hidden rounded-md border border-hairline bg-paper px-2 py-0.5 font-mono text-[11px] text-muted sm:inline">
            {shortcut}
          </kbd>
        </button>

      </div>

    </header>
  );
}