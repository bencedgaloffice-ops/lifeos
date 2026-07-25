import { cn } from "@/lib/utils";

/**
 * Brand marks for the Hungarian grocery chains.
 *
 * These are hand-drawn SVG wordmarks built from each chain's real brand colours
 * and visual signature (Lidl's roundel, Tesco's red underscores, SPAR's fir,
 * ALDI's arc). They are recognisable brand-styled badges, not the official logo
 * files — those are trademarked assets we don't redistribute. Being SVG they
 * stay crisp at any size and add no network requests.
 */

export function StoreLogo({ slug, className }: { slug: string; className?: string }) {
  const box = cn("h-7 w-[76px] flex-none overflow-hidden rounded-[5px]", className);

  switch (slug) {
    case "metro":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="METRO">
          <rect width="96" height="32" fill="#ffffff" />
          <text x="48" y="19" textAnchor="middle" fontSize="14" fontWeight="800" fill="#003D7D" fontFamily="Arial, sans-serif" letterSpacing="0.5">
            METRO
          </text>
          <path d="M18 24 Q48 30 78 24" stroke="#FFC400" strokeWidth="3.4" fill="none" strokeLinecap="round" />
        </svg>
      );

    case "tesco":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="Tesco">
          <rect width="96" height="32" fill="#ffffff" />
          <text x="48" y="18" textAnchor="middle" fontSize="14" fontWeight="700" fill="#00539F" fontFamily="Arial, sans-serif" letterSpacing="0.4">
            TESCO
          </text>
          {[26, 37, 48, 59, 70].map((x) => (
            <rect key={x} x={x - 4} y="22" width="8" height="2.6" rx="1.3" fill="#EE1C2E" />
          ))}
        </svg>
      );

    case "auchan":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="Auchan">
          <rect width="96" height="32" fill="#ffffff" />
          {/* stylised bird */}
          <path d="M12 15 q5 -6 10 -1 q-5 -1 -7 3 z" fill="#E2001A" />
          <text x="54" y="21" textAnchor="middle" fontSize="14" fontWeight="700" fill="#E2001A" fontFamily="Arial, sans-serif">
            Auchan
          </text>
        </svg>
      );

    case "lidl":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="Lidl">
          <rect width="96" height="32" fill="#ffffff" />
          {/* the roundel: yellow disc with a red ring on blue */}
          <circle cx="18" cy="16" r="11" fill="#0050AA" />
          <circle cx="18" cy="16" r="8" fill="#FFF000" stroke="#E60A14" strokeWidth="2.4" />
          <text x="60" y="21" textAnchor="middle" fontSize="15" fontWeight="800" fill="#0050AA" fontFamily="Arial, sans-serif">
            Lidl
          </text>
        </svg>
      );

    case "aldi":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="ALDI">
          <rect width="96" height="32" fill="#ffffff" />
          {/* the arc sweep above the wordmark */}
          <path d="M22 11 Q48 1 74 11" stroke="#F5A300" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M24 14 Q48 5 72 14" stroke="#E30613" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          <text x="48" y="26" textAnchor="middle" fontSize="14" fontWeight="800" fill="#00005F" fontFamily="Arial, sans-serif" letterSpacing="1">
            ALDI
          </text>
        </svg>
      );

    case "spar":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="SPAR">
          <rect width="96" height="32" fill="#ffffff" />
          {/* the fir */}
          <path d="M17 6 L24 15 L20.5 15 L26 24 L8 24 L13.5 15 L10 15 Z" fill="#009640" />
          <text x="60" y="22" textAnchor="middle" fontSize="15" fontWeight="800" fill="#EC1C24" fontFamily="Arial, sans-serif" letterSpacing="0.6">
            SPAR
          </text>
        </svg>
      );

    case "penny":
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="Penny">
          <rect width="96" height="32" fill="#D81E05" />
          <text x="48" y="21" textAnchor="middle" fontSize="14" fontWeight="800" fill="#ffffff" fontFamily="Arial, sans-serif" letterSpacing="1.2">
            PENNY
          </text>
        </svg>
      );

    default:
      return (
        <svg viewBox="0 0 96 32" className={box} role="img" aria-label="Store">
          <rect width="96" height="32" fill="#2a2d33" />
          <text x="48" y="21" textAnchor="middle" fontSize="12" fontWeight="700" fill="#c9cdd4" fontFamily="Arial, sans-serif">
            STORE
          </text>
        </svg>
      );
  }
}
