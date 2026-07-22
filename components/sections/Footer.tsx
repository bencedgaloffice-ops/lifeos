import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";

const columns = [
  {
    title: "Product",
    links: ["Modules", "Dashboard", "Intelligence", "Pricing", "Roadmap"],
  },
  {
    title: "Company",
    links: ["About", "Manifesto", "Careers", "Press"],
  },
  {
    title: "Resources",
    links: ["Security", "Privacy", "Support", "Status"],
  },
];

export function Footer() {
  return (
    <footer className="relative border-t border-white/8">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="text-[0.95rem] font-semibold tracking-tight">LifeOS</span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/45">
              Your personal operating system. Protection, provision, and legacy —
              one beautiful home for your entire life.
            </p>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="text-eyebrow text-white/40">{col.title}</h3>
              <ul className="mt-4 flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-white/55 transition-colors hover:text-white"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-14 hairline" />

        <div className="mt-8 flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-white/40">
            © {new Date().getFullYear()} LifeOS. Built for a life on purpose.
          </p>
          <div className="flex items-center gap-6 text-sm text-white/40">
            <a href="#" className="transition-colors hover:text-white">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-white">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-white">
              Cookies
            </a>
          </div>
        </div>
      </Container>
    </footer>
  );
}
