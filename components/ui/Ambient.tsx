/** Fixed, decorative background: deep vacuum, faint grid, and blue aurora. */
export function Ambient() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* base */}
      <div className="absolute inset-0 bg-base" />
      {/* top aurora */}
      <div
        className="absolute -top-1/3 left-1/2 h-[80vh] w-[120vw] -translate-x-1/2 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 50% 50% at 50% 50%, rgba(59,130,246,0.16), transparent 70%)",
        }}
      />
      {/* faint grid */}
      <div
        className="absolute inset-0 opacity-[0.5] mask-fade-b"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* lower left glow */}
      <div
        className="absolute bottom-0 left-0 h-[60vh] w-[60vw] opacity-40"
        style={{
          background:
            "radial-gradient(circle at 20% 80%, rgba(59,130,246,0.1), transparent 60%)",
        }}
      />
    </div>
  );
}
