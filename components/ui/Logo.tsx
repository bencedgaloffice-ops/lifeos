import { cn } from "@/lib/utils";

/** Minimal LifeOS mark — concentric orbit with an accent core. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn(className)}
      role="img"
      aria-label="LifeOS logo"
    >
      <defs>
        <linearGradient id="lifeos-g" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#3B82F6" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" stroke="url(#lifeos-g)" strokeWidth="1.5" opacity="0.9" />
      <circle cx="16" cy="16" r="7.5" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.25" />
      <circle cx="16" cy="16" r="3" fill="url(#lifeos-g)" />
      <circle cx="27.2" cy="12" r="1.6" fill="#3B82F6" />
    </svg>
  );
}
