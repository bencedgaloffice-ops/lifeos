"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { steps } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function HowItWorks() {
  return (
    <section id="how" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="How LifeOS Works"
          title="Three steps to a life with a system."
          description="No complicated setup. LifeOS meets you where you are and grows into everything you need."
        />

        <motion.ol
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative mt-20 grid gap-12 md:grid-cols-3 md:gap-8"
        >
          {/* Connecting line */}
          <span
            aria-hidden
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-white/12 to-transparent md:block"
          />

          {steps.map((step) => (
            <motion.li key={step.number} variants={fadeUp} className="relative flex flex-col">
              <div className="relative mb-6 flex h-12 w-12 items-center justify-center rounded-2xl glass-strong">
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-2xl bg-accent/20 blur-md"
                />
                <span className="relative text-sm font-semibold text-accent-soft">
                  {step.number}
                </span>
              </div>
              <h3 className="text-title gradient-text">{step.title}</h3>
              <p className="mt-3 text-[0.975rem] leading-relaxed text-white/55">
                {step.description}
              </p>
            </motion.li>
          ))}
        </motion.ol>
      </Container>
    </section>
  );
}
