/**
 * PageHeading — canonical page/section heading component.
 *
 * Font:    IBM Plex Sans (font-sans, inherited from :root)
 * Size:    15px (text-[15px])
 * Weight:  600 (font-semibold)
 * Case:    sentence case — never uppercase or title-case in code
 * Color:   text-ink
 * Spacing: -0.005em letter-spacing
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
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <Tag className="flex items-center gap-[7px] text-[15px] font-semibold leading-snug tracking-[-0.005em] text-ink">
        {Icon && (
          <Icon
            size={15}
            aria-hidden="true"
            className="shrink-0 text-muted"
          />
        )}
        {children}
      </Tag>
      {meta && (
        <p className="text-[12px] leading-relaxed text-muted"
           style={{ paddingLeft: Icon ? "22px" : undefined }}>
          {meta}
        </p>
      )}
    </div>
  );
}
