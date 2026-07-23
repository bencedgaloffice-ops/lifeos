/**
 * Top-down silhouette of a black full-size luxury SUV in the boxy, upright
 * proportions of a Cadillac Escalade — drawn as an inline SVG string so it can
 * live inside a Leaflet divIcon. Nose points "up" (north / 0°); the map layer
 * rotates the wrapper to the vehicle's real heading. Not Cadillac branding —
 * a generic luxury-SUV shape, chrome trim, red taillights, white headlights.
 */
export const ESCALADE_SVG = `
<svg width="26" height="46" viewBox="0 0 26 46" xmlns="http://www.w3.org/2000/svg" style="display:block;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6))">
  <defs>
    <linearGradient id="esc-body" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#1a1c20"/>
      <stop offset="0.5" stop-color="#0b0c0e"/>
      <stop offset="1" stop-color="#1a1c20"/>
    </linearGradient>
  </defs>
  <!-- body -->
  <rect x="3.5" y="2" width="19" height="42" rx="4.5" fill="url(#esc-body)" stroke="#3a3f47" stroke-width="1"/>
  <!-- chrome side trim -->
  <rect x="4.6" y="6" width="0.9" height="34" fill="#5b6472" opacity="0.8"/>
  <rect x="20.5" y="6" width="0.9" height="34" fill="#5b6472" opacity="0.8"/>
  <!-- windshield -->
  <path d="M5.5 12 h15 l-1.6 5 h-11.8 z" fill="#0f2233" stroke="#2c3a48" stroke-width="0.5"/>
  <!-- roof glass -->
  <rect x="6.5" y="18.5" width="13" height="9" rx="1.5" fill="#101418" stroke="#2c3a48" stroke-width="0.5"/>
  <!-- rear window -->
  <path d="M6.9 34 h12.2 l-1.4 -4 h-9.4 z" fill="#0f2233" stroke="#2c3a48" stroke-width="0.5"/>
  <!-- chrome grille -->
  <rect x="7" y="3.2" width="12" height="2.4" rx="0.6" fill="#7d8794"/>
  <!-- headlights -->
  <rect x="4.6" y="3" width="2.4" height="2" rx="0.6" fill="#fdf6d8"/>
  <rect x="19" y="3" width="2.4" height="2" rx="0.6" fill="#fdf6d8"/>
  <!-- taillights -->
  <rect x="4.6" y="41" width="2.6" height="2" rx="0.6" fill="#e01f27"/>
  <rect x="18.8" y="41" width="2.6" height="2" rx="0.6" fill="#e01f27"/>
</svg>`;
