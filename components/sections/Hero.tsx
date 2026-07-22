"use client";

import { motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { EarthCanvas } from "@/components/three/EarthCanvas";
import { easePremium } from "@/lib/motion";

const words = ["ORGANIZED.", "DESIGNED.", "REMEMBERED."];

export function Hero() {
  return (
    <section
      id="main"
      className="relative flex min-h-[100svh] flex-col items-center justify-center overflow-hidden"
    >
      {/* 3D Earth centerpiece */}
      <div className="absolute inset-0 -z-[1]">
        <EarthCanvas />
      </div>

      {/* Readability gradient so headline sits above the globe */}
      <div
        aria-hidden
        className="absolute inset-0 -z-[1]"
        style={{
          background:
            "radial-gradient(ellipse 60% 45% at 50% 42%, transparent, rgba(5,5,5,0.35) 70%), linear-gradient(180deg, rgba(5,5,5,0.55) 0%, transparent 25%, transparent 65%, #050505 100%)",
        }}
      />

      <Container className="relative z-10 flex flex-col items-center text-center">
        <motion.span
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easePremium, delay: 0.35 }}
          className="text-eyebrow mb-7 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-white/70"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow-sm" />
          Your personal operating system
        </motion.span>

        <h1 className="text-display">
          <motion.span
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easePremium, delay: 0.45 }}
            className="block gradient-text"
          >
            YOUR LIFE.
          </motion.span>
          {words.map((word, i) => (
            <motion.span
              key={word}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.9,
                ease: easePremium,
                delay: 0.6 + i * 0.13,
              }}
              className="block gradient-text-accent"
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easePremium, delay: 1.05 }}
          className="mt-8 max-w-xl text-pretty text-base leading-relaxed text-white/60 md:text-lg"
        >
          LifeOS is your personal operating system that connects your goals,
          finances, dreams, memories, projects, and future into one intelligent
          life dashboard.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: easePremium, delay: 1.2 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button as="a" href="#cta" variant="primary" size="lg">
            Start Building Your Life
            <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
          </Button>
          <Button as="a" href="#system" variant="secondary" size="lg">
            Explore LifeOS
          </Button>
        </motion.div>
      </Container>

      {/* Scroll cue */}
      <motion.a
        href="#system"
        aria-label="Scroll to explore"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1, delay: 1.6 }}
        className="absolute bottom-8 left-1/2 z-10 -translate-x-1/2"
      >
        <motion.span
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex h-10 w-6 items-start justify-center rounded-full border border-white/20 p-1.5"
        >
          <ChevronDown className="h-3.5 w-3.5 text-white/50" />
        </motion.span>
      </motion.a>
    </section>
  );
}
