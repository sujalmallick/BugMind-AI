import logo from "../../assets/bugmind2.png";
import favicon from "../../assets/favicon.png";

const SIZES = {
  sm: { icon: "h-7 w-7", word: "h-[24px]" },
  md: { icon: "h-8 w-8", word: "h-[28px]" },
  lg: { icon: "h-9 w-9", word: "h-[32px]" },
};

// Favicon + wordmark lockup used in every header/footer.
export default function BrandMark({ size = "md", className = "" }) {
  const s = SIZES[size] ?? SIZES.md;
  return (
    <span className={`flex shrink-0 items-center gap-2 ${className}`}>
      <img src={favicon} alt="" aria-hidden="true" className={`${s.icon} object-contain`} />
      <img src={logo} alt="BugMind AI" className={`${s.word} w-auto object-contain`} />
    </span>
  );
}
