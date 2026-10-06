/**
 * PageHeading — canonical page/section heading component.
 *
 * Font:    Instrument Sans (font-sans, inherited from :root)
 * Size:    h1 → 24/26px page title; h2/h3 → 15px section heading
 * Weight:  600 (font-semibold)
 * Case:    sentence case — never uppercase or title-case in code
 * Color:   text-ink
 *
 * Props:
 *   as        – HTML element to render ("h1" | "h2" | "h3"). Default: "h1".
 *   icon      – Optional Lucide icon component (15px, text-muted).
 *   meta      – Optional string/node rendered below as 12px text-muted metadata row.
 *   className – Extra classes forwarded to the wrapper.
 *   children  – The heading text.
 */
export default function PageHeading({
  as: Tag = "h1",
  icon: Icon,
  meta,
  className = "",
  children,
}) {
  const isPage = Tag === "h1";
  return (
    <div className={`flex flex-col ${isPage ? "gap-1.5" : "gap-0.5"} ${className}`}>
      <Tag
        className={`flex items-center gap-[7px] font-semibold text-ink ${
          isPage
            ? "text-2xl leading-tight tracking-[-0.025em] sm:text-[1.625rem]"
            : "text-[15px] leading-snug tracking-[-0.005em]"
        }`}
      >
        {Icon && (
          <Icon
            size={isPage ? 20 : 15}
            aria-hidden="true"
            className="shrink-0 text-muted"
          />
        )}
        {children}
      </Tag>
      {meta && (
        <p className={`${isPage ? "max-w-2xl text-[14px]" : "text-[12px]"} leading-relaxed text-muted`}
           style={{ paddingLeft: Icon ? (isPage ? "27px" : "22px") : undefined }}>
          {meta}
        </p>
      )}
    </div>
  );
}
