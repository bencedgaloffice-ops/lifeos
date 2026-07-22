"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassCardProps = HTMLMotionProps<"div"> & {
  interactive?: boolean;
  glow?: boolean;
  children: React.ReactNode;
};

/**
 * Premium glass surface with a soft top-light gradient, hairline border,
 * and an optional lift-on-hover interaction.
 */
export function GlassCard({
  interactive = true,
  glow = false,
  className,
  children,
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        "group relative overflow-hidden rounded-3xl glass shadow-glass",
        interactive &&
          "transition-transform duration-500 ease-premium hover:-translate-y-1.5",
        className,
      )}
      {...props}
    >
      {/* Top light sheen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
      />
      {/* Hover glow */}
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-3xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "radial-gradient(600px circle at 50% 0%, rgba(59,130,246,0.15), transparent 60%)",
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}
