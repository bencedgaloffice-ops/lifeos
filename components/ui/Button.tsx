"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";
type Size = "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  as?: "button" | "a";
  href?: string;
};

const base =
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-all duration-500 ease-premium focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 select-none";

const sizes: Record<Size, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-[0.95rem]",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-white text-black shadow-[0_10px_40px_-12px_rgba(59,130,246,0.6)] hover:shadow-[0_16px_60px_-14px_rgba(59,130,246,0.85)] hover:-translate-y-0.5",
  secondary:
    "glass text-white hover:bg-[rgba(255,255,255,0.1)] hover:-translate-y-0.5",
  ghost:
    "text-white/70 hover:text-white hover:bg-[rgba(255,255,255,0.05)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "primary", size = "lg", as = "button", className, children, href, ...props },
    ref,
  ) => {
    const classes = cn(base, sizes[size], variants[variant], className);

    if (as === "a") {
      return (
        <a href={href} className={classes}>
          <span className="relative z-10 inline-flex items-center gap-2">
            {children}
          </span>
        </a>
      );
    }

    return (
      <button ref={ref} className={classes} {...props}>
        <span className="relative z-10 inline-flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
