import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { StructuredData } from "@/components/StructuredData";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

// Display face for the command-center identity, level titles and headings.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const siteUrl = "https://lifeos.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "LifeOS — Your Personal Operating System",
    template: "%s · LifeOS",
  },
  description:
    "LifeOS is your personal operating system that connects your goals, finances, dreams, memories, projects, and future into one intelligent life dashboard.",
  keywords: [
    "LifeOS",
    "personal operating system",
    "life dashboard",
    "goals",
    "finances",
    "journal",
    "life timeline",
    "productivity",
    "AI",
  ],
  authors: [{ name: "LifeOS" }],
  creator: "LifeOS",
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "LifeOS — Your Personal Operating System",
    description:
      "Connect your goals, finances, dreams, memories, projects, and future into one intelligent life dashboard.",
    siteName: "LifeOS",
  },
  twitter: {
    card: "summary_large_image",
    title: "LifeOS — Your Personal Operating System",
    description:
      "Connect your goals, finances, dreams, memories, projects, and future into one intelligent life dashboard.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getServerLocale();

  return (
    <html lang={locale} className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <StructuredData />
      </head>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
        >
          Skip to content
        </a>
        <LocaleProvider initialLocale={locale}>{children}</LocaleProvider>
      </body>
    </html>
  );
}
