"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GlassCard } from "@/components/ui/GlassCard";
import { testimonials } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function Testimonials() {
  return (
    <section id="testimonials" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="Loved by intentional people"
          title="A quiet revolution in how people live."
          description="The people building deliberate lives are choosing LifeOS as their foundation."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 grid gap-6 md:grid-cols-2"
        >
          {testimonials.map((t) => (
            <motion.div key={t.name} variants={fadeUp}>
              <GlassCard glow className="flex h-full flex-col p-8 md:p-9">
                <p className="text-pretty text-lg leading-relaxed text-white/80">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-8 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-sm font-semibold">
                    {t.initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{t.name}</div>
                    <div className="text-sm text-white/45">{t.role}</div>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
