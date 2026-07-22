import type { Variants } from "framer-motion";

export const easePremium = [0.16, 1, 0.3, 1] as const;

/** Fade + rise, used for most section entrances. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: easePremium },
  },
};

/** Container that staggers its children on scroll into view. */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.05 },
  },
};

/** Soft scale-in for cards and media. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.85, ease: easePremium },
  },
};

/** Shared viewport config so sections animate once, slightly early. */
export const viewportOnce = { once: true, margin: "-80px" } as const;
