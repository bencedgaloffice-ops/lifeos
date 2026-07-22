"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function FinalCTA() {
  return (
    <section id="cta" className="relative section-py">
      <Container>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative overflow-hidden rounded-[2.5rem] glass px-6 py-20 text-center shadow-glass md:px-16 md:py-28"
        >
          {/* Aurora backdrop */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-[1]"
            style={{
              background:
                "radial-gradient(ellipse 60% 90% at 50% 0%, rgba(59,130,246,0.28), transparent 65%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-[120%] -translate-x-1/2 rounded-full opacity-50 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.3), transparent 60%)" }}
          />

          <motion.h2 variants={fadeUp} className="text-display mx-auto max-w-3xl">
            <span className="gradient-text">Your future deserves</span>
            <br />
            <span className="gradient-text-accent">a system.</span>
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-7 max-w-xl text-pretty text-base leading-relaxed text-white/60 md:text-lg"
          >
            Stop scattering your life across a dozen apps. Bring it home to one
            intelligent operating system — and start building on purpose.
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Button as="a" href="#" variant="primary" size="lg">
              Start Building Your Life
              <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </Button>
            <Button as="a" href="#dashboard" variant="secondary" size="lg">
              See the Dashboard
            </Button>
          </motion.div>
        </motion.div>
      </Container>
    </section>
  );
}
