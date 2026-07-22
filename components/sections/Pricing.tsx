"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { pricing } from "@/lib/content";
import { scaleIn, viewportOnce } from "@/lib/motion";

export function Pricing() {
  return (
    <section id="pricing" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="Pricing Preview"
          title="One system. One simple plan."
          description="LifeOS is launching soon. Founding members lock in early pricing — forever."
        />

        <motion.div
          variants={scaleIn}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="relative mx-auto mt-16 max-w-md"
        >
          {/* Glow */}
          <div
            aria-hidden
            className="absolute -inset-4 -z-[1] rounded-[2.5rem] opacity-60 blur-2xl"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.4), transparent 70%)",
            }}
          />

          <div className="relative overflow-hidden rounded-[2rem] glass-strong p-8 shadow-glass md:p-10">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

            <div className="flex items-center justify-between">
              <span className="text-eyebrow rounded-full bg-accent/15 px-3 py-1.5 text-accent-soft">
                Founding Access
              </span>
              <span className="text-sm text-white/45">Limited</span>
            </div>

            <h3 className="mt-6 text-2xl font-semibold tracking-tight">{pricing.name}</h3>
            <div className="mt-4 flex items-end gap-1">
              <span className="text-5xl font-semibold tracking-tightest">{pricing.price}</span>
              <span className="mb-1.5 text-white/45">{pricing.cadence}</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/50">{pricing.note}</p>

            <ul className="mt-8 flex flex-col gap-3.5">
              {pricing.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-[0.95rem] text-white/75">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent-soft">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <Button as="a" href="#cta" variant="primary" size="lg" className="mt-9 w-full">
              Claim Founding Access
            </Button>
            <p className="mt-4 text-center text-xs text-white/35">
              No credit card required · Cancel anytime
            </p>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
