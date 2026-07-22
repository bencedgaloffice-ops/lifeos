"use client";

import { motion } from "framer-motion";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";
import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: SectionHeadingProps) {
  return (
    <motion.header
      variants={staggerContainer}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={cn(
        "flex max-w-2xl flex-col gap-5",
        align === "center" ? "mx-auto items-center text-center" : "items-start text-left",
        className,
      )}
    >
      {eyebrow && (
        <motion.span
          variants={fadeUp}
          className="text-eyebrow inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-white/70"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow-sm" />
          {eyebrow}
        </motion.span>
      )}
      <motion.h2 variants={fadeUp} className="text-headline gradient-text text-balance">
        {title}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeUp}
          className="max-w-prose2 text-pretty text-base leading-relaxed text-white/55 md:text-lg"
        >
          {description}
        </motion.p>
      )}
    </motion.header>
  );
}
