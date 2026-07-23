"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

/* ------------------------------------------------------------------
   Elegant financial ambience — a handful of near-invisible symbols
   drifting down the far edges of the screen. Never crosses the globe,
   never reads as "dollar rain": opacity stays under 15% and everything
   fades at both ends of its fall.
------------------------------------------------------------------ */

const SYMBOLS = ["$", "€", "£", "¥", "+0.4%", "-0.2%", "1,248", "402.6", "12.4K", "+1.1%"];

type Particle = {
  id: number;
  side: "left" | "right";
  symbol: string;
  xOffset: number; // percent within the side column
  duration: number;
  delay: number;
  fontSize: number;
  peakOpacity: number;
};

function generateParticles(count: number): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      id: i,
      side: i % 2 === 0 ? "left" : "right",
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      xOffset: Math.random() * 70,
      duration: 18 + Math.random() * 14,
      delay: Math.random() * 16,
      fontSize: 11 + Math.random() * 9,
      peakOpacity: 0.05 + Math.random() * 0.09, // stays well under the 15% ceiling
    });
  }
  return particles;
}

function ParticleColumn({ side, particles }: { side: "left" | "right"; particles: Particle[] }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute top-0 h-full w-[10vw] max-w-[140px] overflow-hidden ${
        side === "left" ? "left-0" : "right-0"
      }`}
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute font-mono font-light tracking-wide text-white"
          style={{
            left: `${p.xOffset}%`,
            fontSize: p.fontSize,
            textShadow: "0 0 12px rgba(120,170,255,0.5)",
          }}
          initial={{ y: "-10vh", opacity: 0 }}
          animate={{ y: "110vh", opacity: [0, p.peakOpacity, p.peakOpacity, 0] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "linear",
            opacity: { duration: p.duration, times: [0, 0.15, 0.8, 1], ease: "linear" },
          }}
        >
          {p.symbol}
        </motion.span>
      ))}
    </div>
  );
}

export function FinancialParticles() {
  // Generated post-mount only — keeps SSR output empty so hydration never
  // diffs against client-random values.
  const [particles, setParticles] = useState<Particle[] | null>(null);

  useEffect(() => {
    setParticles(generateParticles(16));
  }, []);

  if (!particles) return null;

  const left = particles.filter((p) => p.side === "left");
  const right = particles.filter((p) => p.side === "right");

  return (
    <>
      <ParticleColumn side="left" particles={left} />
      <ParticleColumn side="right" particles={right} />
    </>
  );
}
