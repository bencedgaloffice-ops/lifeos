import { Ambient } from "@/components/ui/Ambient";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/sections/Hero";
import { Philosophy } from "@/components/sections/Philosophy";
import { Modules } from "@/components/sections/Modules";
import { DashboardShowcase } from "@/components/sections/DashboardShowcase";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { AI } from "@/components/sections/AI";
import { Testimonials } from "@/components/sections/Testimonials";
import { Pricing } from "@/components/sections/Pricing";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <Ambient />
      <Navbar />
      <main className="relative">
        <Hero />
        <Philosophy />
        <Modules />
        <DashboardShowcase />
        <HowItWorks />
        <AI />
        <Testimonials />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}
