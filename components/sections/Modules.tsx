"use client";

import { motion } from "framer-motion";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { modules } from "@/lib/content";
import { fadeUp, staggerContainer, viewportOnce } from "@/lib/motion";

export function Modules() {
  return (
    <section id="modules" className="relative section-py">
      <Container>
        <SectionHeading
          eyebrow="Modules"
          title="Everything belongs inside one beautiful system."
          description="Ten intelligent modules, designed to work as one. Each one powerful alone — extraordinary together."
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <motion.article
                key={mod.title}
                variants={fadeUp}
                className="group relative overflow-hidden rounded-3xl glass p-6 shadow-glass transition-all duration-500 ease-premium hover:-translate-y-1.5 hover:border-[rgba(59,130,246,0.35)]"
              >
                {/* hover spotlight */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(400px circle at 50% 0%, rgba(59,130,246,0.16), transparent 65%)",
                  }}
                />
                <div className="relative z-10">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl glass-strong text-white/80 transition-all duration-500 group-hover:text-accent-soft group-hover:shadow-glow-sm">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-5 text-[1.05rem] font-semibold tracking-tight text-white">
                    {mod.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/50">
                    {mod.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </motion.div>
      </Container>
    </section>
  );
}
