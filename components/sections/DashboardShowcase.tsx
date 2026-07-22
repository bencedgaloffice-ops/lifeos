"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { scaleIn, viewportOnce } from "@/lib/motion";
import { DashboardMock } from "@/components/dashboard/DashboardMock";

export function DashboardShowcase() {
  return (
    <section id="dashboard" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="The Dashboard"
          title="Your entire life, at a single glance."
          description="Schedule, finances, goals, dreams, projects, and memories — one calm, cinematic control center for the life you're building."
        />
      </Container>

      <motion.div
        variants={scaleIn}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="relative mx-auto mt-16 w-full max-w-6xl px-4"
      >
        {/* Ambient glow behind the laptop */}
        <div
          aria-hidden
          className="absolute inset-x-8 top-8 -z-[1] h-[70%] rounded-full opacity-70 blur-3xl"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.4), transparent 70%)",
          }}
        />

        <Laptop>
          <DashboardMock />
        </Laptop>
      </motion.div>
    </section>
  );
}

/** Cinematic laptop frame that holds the live dashboard. */
function Laptop({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Screen */}
      <div className="relative rounded-t-[1.6rem] border border-white/12 bg-[#0a0a0b] p-2 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] sm:p-2.5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
        {/* Camera */}
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-white/5" />
        <div className="overflow-hidden rounded-[1.1rem] border border-white/8 bg-[#050505]">
          <div className="aspect-[16/10] w-full overflow-hidden">{children}</div>
        </div>
      </div>
      {/* Base */}
      <div className="relative mx-auto h-4 w-full rounded-b-[1.6rem] border-x border-b border-white/12 bg-gradient-to-b from-[#141416] to-[#0a0a0b]">
        <div className="absolute left-1/2 top-0 h-1.5 w-28 -translate-x-1/2 rounded-b-lg bg-black/60" />
      </div>
      <div className="mx-auto h-1 w-[86%] rounded-b-full bg-black/50 blur-[1px]" />
    </div>
  );
}
