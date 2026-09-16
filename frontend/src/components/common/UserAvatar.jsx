import { useState, useEffect } from "react";
import { getAvatarUrl } from "../../utils/avatarUrl";

export default function UserAvatar({
  user,
  size = "md",
  className = "",
  initials = null,
}) {
  const [imgError, setImgError] = useState(false);
  const avatarUrl = user?.avatar_url ? getAvatarUrl(user.avatar_url) : null;

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const userInitials =
    initials ||
    (user?.name
      ? user.name
          .split(" ")
          .filter(Boolean)
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2)
      : user?.email
      ? user.email[0].toUpperCase()
      : "U");

  const sizeClasses =
    {
      xs: "h-6 w-6 text-[10px]",
      sm: "h-7 w-7 text-[11px]",
      md: "h-8 w-8 text-xs",
      lg: "h-10 w-10 text-sm",
      xl: "h-20 w-20 text-xl",
    }[size] || "h-8 w-8 text-xs";

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={user?.name || "User avatar"}
        onError={() => setImgError(true)}
        className={`rounded-full object-cover shrink-0 ${sizeClasses} ${className}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-signal-soft font-mono font-bold text-signal select-none ring-1 ring-hairline ${sizeClasses} ${className}`}
    >
      {userInitials}
    </span>
  );
}
