"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { pillars } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function Philosophy() {
  return (
    <section id="system" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="One System"
          title={
            <>
              One system.
              <br />
              Every part of your life.
            </>
          }
          description="LifeOS is built on three timeless principles — the foundation of a life lived with intention."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 grid gap-6 md:grid-cols-3"
        >
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <motion.div key={pillar.title} variants={fadeUp}>
                <GlassCard glow className="h-full p-8 md:p-10">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl glass-strong text-accent-soft shadow-glow-sm transition-transform duration-500 group-hover:scale-110">
                    <Icon className="h-6 w-6" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-7 text-title gradient-text">{pillar.title}</h3>
                  <p className="mt-3 text-[0.975rem] leading-relaxed text-white/55">
                    {pillar.description}
                  </p>
                  <span className="mt-8 block h-px w-full bg-gradient-to-r from-white/12 to-transparent" />
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}
