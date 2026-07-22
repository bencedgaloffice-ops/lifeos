"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { AISphereCanvas } from "@/components/three/AISphereCanvas";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function AI() {
  return (
    <section id="ai" className="relative section-py overflow-hidden">
      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Sphere */}
          <div className="relative order-first mx-auto aspect-square w-full max-w-md lg:order-last">
            <div
              aria-hidden
              className="absolute inset-0 -z-[1] rounded-full opacity-70 blur-3xl"
              style={{
                background:
                  "radial-gradient(circle, rgba(59,130,246,0.35), transparent 65%)",
              }}
            />
            <AISphereCanvas />
          </div>

          {/* Copy */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="flex flex-col items-start gap-6"
          >
            <motion.span
              variants={fadeUp}
              className="text-eyebrow inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-white/70"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow-sm" />
              Intelligence
            </motion.span>
            <motion.h2 variants={fadeUp} className="text-headline">
              <span className="gradient-text">Your life.</span>
              <br />
              <span className="gradient-text-accent">Understood.</span>
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="max-w-md text-pretty text-base leading-relaxed text-white/55 md:text-lg"
            >
              LifeOS learns your journey and helps you make better decisions. It sees
              the connections between your money, your goals, and your time — and
              quietly guides you toward the life you intend to build.
            </motion.p>
            <motion.ul variants={fadeUp} className="mt-2 flex flex-col gap-3">
              {[
                "Understands your finances, goals, and calendar as one",
                "Surfaces the decisions that actually move your life",
                "Private by design — your life stays yours",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-white/65">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-glow-sm" />
                  <span className="text-[0.975rem] leading-relaxed">{item}</span>
                </li>
              ))}
            </motion.ul>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
