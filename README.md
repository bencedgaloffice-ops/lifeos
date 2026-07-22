# LifeOS — Landing Page

A world-class, production-ready marketing site for **LifeOS**, a Personal
Operating System that connects every important part of a person's life —
calendar, goals, projects, dreams, journal, documents, money, investments, AI,
memories, and a full life timeline — into one intelligent system.

Built to feel like an Apple keynote: luxury minimalism, cinematic motion, a
custom shader-driven 3D Earth, and a soft blue glow throughout.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** with a custom design system (tokens, glass, gradients, shadows)
- **Framer Motion** for entrance and hover choreography
- **Three.js** + **React Three Fiber** + **drei** for the procedural 3D Earth and AI sphere
- **Lucide** icons

The Earth and AI sphere are fully procedural GLSL shaders — continents, clouds,
city lights, atmospheric rim glow and Fresnel lighting are generated at runtime,
so the site ships with **zero external texture assets**.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Production build

```bash
npm run build
npm run start
```

## Project structure

```
app/
  layout.tsx            # Metadata, fonts, SEO, structured data
  page.tsx              # Section composition
  globals.css           # Design system + Tailwind layers
  icon.svg              # Favicon
  robots.ts / sitemap.ts

components/
  Navbar.tsx
  sections/             # One component per landing section (1–10)
  dashboard/            # Realistic LifeOS dashboard mock
  three/                # Earth + AI sphere (lazy-loaded, client only)
  ui/                   # Reusable primitives: Button, GlassCard, Container…

lib/
  content.ts            # All copy & data (single source of truth)
  motion.ts             # Shared Framer Motion variants
  utils.ts              # cn() classname helper
```

## Sections

1. **Hero** — full-viewport rotating 3D Earth, headline, primary CTAs
2. **Philosophy** — Protection · Provision · Legacy
3. **Modules** — the ten life modules
4. **Dashboard Showcase** — cinematic laptop with a real LifeOS dashboard
5. **How It Works** — Collect · Organize · Build
6. **AI** — glowing intelligence sphere
7. **Testimonials**
8. **Pricing Preview**
9. **Final CTA**
10. **Footer**

## Design system

Defined in `tailwind.config.ts` and `app/globals.css`:

| Token       | Value                     |
| ----------- | ------------------------- |
| Background  | `#050505`                 |
| Primary     | `#FFFFFF`                 |
| Accent      | `#3B82F6`                 |
| Glass       | `rgba(255,255,255,.06)`   |
| Borders     | `rgba(255,255,255,.12)`   |
| Typography  | Inter                     |

Fully responsive (desktop / tablet / mobile), accessible (skip link, focus
states, reduced-motion support, semantic HTML), and performance-minded (heavy
3D is lazy-loaded on the client after paint).
