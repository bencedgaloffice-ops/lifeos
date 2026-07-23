import { JarvisConsole } from "@/components/jarvis/JarvisConsole";

export const metadata = { title: "Jarvis" };

/**
 * The dedicated Jarvis console. The companion's live state comes from the
 * JarvisProvider that wraps the whole dashboard (see app/dashboard/layout.tsx),
 * so this page shares one session with the floating orb widget.
 */
export default function JarvisPage() {
  return <JarvisConsole />;
}
