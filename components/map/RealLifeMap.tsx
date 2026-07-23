"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Car, Navigation, Gauge, Clock, CheckCircle2, X } from "lucide-react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ROADS } from "@/lib/hungary-roads";
import { LOCATION_CLUSTERS } from "@/lib/hungary-locations";
import { computeVehicleState, type VehicleState } from "@/lib/vehicle-sim";
import { ESCALADE_SVG } from "./escalade";

const STATUS_COLOR: Record<VehicleState["status"], string> = {
  driving: "#67E8F9",
  returning: "#67E8F9",
  working: "#FBBF24",
  arrived: "#34D399",
  waiting: "#9CA3AF",
};

/** Compass bearing (degrees, 0 = north/up) from point a to point b, both [lat, lon]. */
function bearing(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = a;
  const [lat2, lon2] = b;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/**
 * A genuine dark street map of Hungary (Leaflet + CARTO "dark matter" raster
 * tiles — real roads, real place names, no API key) with a black luxury-SUV
 * marker driving the real motorway network continuously. The vehicle's
 * position is a pure function of the wall clock (lib/vehicle-sim), so it never
 * stops and every viewer sees it in the same place — a simulated schedule now,
 * ready to be swapped for real GPS tracking later.
 */
export function RealLifeMap({ onNavigate }: { onNavigate?: (href: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const carRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const trailPts = useRef<[number, number][]>([]);
  const headingRef = useRef(0);
  const navRef = useRef(onNavigate);
  navRef.current = onNavigate;

  const { t } = useLocale();
  const [vehOpen, setVehOpen] = useState(false);
  const [veh, setVeh] = useState<VehicleState | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      minZoom: 6,
      maxZoom: 16,
    }).setView([47.05, 18.7], 7.4);
    mapRef.current = map;

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(map);

    // Real motorway corridors traced in warm amber over the real roads.
    for (const road of ROADS) {
      const pts = road.path.map(([lon, lat]) => [lat, lon] as [number, number]);
      L.polyline(pts, { color: "#F3C969", weight: 3, opacity: 0.55 }).addTo(map);
      const mid = pts[Math.floor(pts.length / 2)];
      L.marker(mid, {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [26, 16],
          html: `<span style="display:inline-block;white-space:nowrap;font:600 10px system-ui;color:#fde9b0;background:rgba(0,0,0,0.55);border:1px solid rgba(253,233,176,0.3);border-radius:9px;padding:1px 6px;">${road.label}</span>`,
        }),
      }).addTo(map);
    }

    // Section clusters at their real coordinates → tap opens its shortcuts.
    for (const c of LOCATION_CLUSTERS) {
      const marker = L.marker([c.lat, c.lon], {
        icon: L.divIcon({
          className: "",
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${c.color};box-shadow:0 0 0 4px ${c.color}33,0 0 14px 2px ${c.color}aa;border:1.5px solid rgba(255,255,255,0.85)"></div>`,
        }),
      }).addTo(map);

      const items = c.items
        .map(
          (it) =>
            `<a href="${it.href}" data-href="${it.href}" class="lifeos-navlink" style="display:block;padding:6px 8px;border-radius:8px;color:#dbe4ee;font:500 12px system-ui;text-decoration:none;">${t(
              `homeMap.${it.labelKey}`,
            )} →</a>`,
        )
        .join("");
      marker.bindPopup(
        `<div style="min-width:180px">
           <div style="font:600 13px system-ui;color:#fff;margin-bottom:2px">${t(`homeMap.${c.nameKey}`)}</div>
           <div style="font:400 11px system-ui;color:rgba(255,255,255,0.55);line-height:1.4;margin-bottom:6px">${t(
             `homeMap.${c.previewKey}`,
           )}</div>
           ${items}
         </div>`,
        { className: "lifeos-popup" },
      );
    }

    // Intercept in-app section links so they route through the app router.
    map.on("popupopen", (e) => {
      const root = (e as unknown as { popup: L.Popup }).popup.getElement();
      root?.querySelectorAll<HTMLAnchorElement>(".lifeos-navlink").forEach((a) => {
        a.addEventListener("click", (ev) => {
          const href = a.getAttribute("data-href");
          if (href && navRef.current) {
            ev.preventDefault();
            navRef.current(href);
          }
        });
      });
    });

    // The vehicle.
    const start = computeVehicleState();
    const car = L.marker([start.position[1], start.position[0]], {
      zIndexOffset: 1000,
      icon: L.divIcon({
        className: "",
        iconSize: [34, 46],
        iconAnchor: [17, 23],
        html: `<div class="escalade-rotor" style="transform:rotate(0deg);transition:transform .25s linear;transform-origin:50% 50%;">${ESCALADE_SVG}</div>`,
      }),
    }).addTo(map);
    car.on("click", () => {
      setVeh(computeVehicleState());
      setVehOpen(true);
    });
    carRef.current = car;

    trailRef.current = L.polyline([], { color: "#67E8F9", weight: 3, opacity: 0.45 }).addTo(map);

    let raf = 0;
    const tick = () => {
      const s = computeVehicleState();
      const [lon, lat] = s.position;
      const prev = car.getLatLng();
      if (Math.abs(lat - prev.lat) > 1e-6 || Math.abs(lon - prev.lng) > 1e-6) {
        headingRef.current = bearing([prev.lat, prev.lng], [lat, lon]);
      }
      car.setLatLng([lat, lon]);
      const rotor = car.getElement()?.querySelector<HTMLElement>(".escalade-rotor");
      if (rotor) rotor.style.transform = `rotate(${headingRef.current}deg)`;

      trailPts.current.push([lat, lon]);
      if (trailPts.current.length > 45) trailPts.current.shift();
      trailRef.current?.setLatLngs(trailPts.current);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      map.remove();
      mapRef.current = null;
    };
    // Re-init on locale change so popup labels stay translated.
  }, [t]);

  // Keep the info panel's numbers live while it's open.
  useEffect(() => {
    if (!vehOpen) return;
    const id = setInterval(() => setVeh(computeVehicleState()), 1000);
    return () => clearInterval(id);
  }, [vehOpen]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0 z-0 overflow-hidden rounded-3xl" style={{ background: "#05070A" }} />

      {vehOpen && veh && (
        <div className="absolute right-3 top-3 z-[500] w-72 rounded-2xl border border-white/10 bg-black/80 p-4 backdrop-blur-md">
          <button
            onClick={() => setVehOpen(false)}
            className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2 pr-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-400/15 text-cyan-300">
              <Car className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-white/40">{t("vehicle.title")}</p>
              <p className="text-sm font-medium text-white/85">{t(`vehicle.status.${veh.status}`)}</p>
            </div>
          </div>

          <div className="mt-4">
            <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
              <Navigation className="h-3.5 w-3.5" /> {t("vehicle.currentMission")}
            </p>
            <p className="text-sm text-white/85">{t(`vehicle.mission.${veh.missionKey}`)}</p>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-xs uppercase tracking-wider text-white/40">{t("vehicle.location")}</p>
            <p className="text-sm text-white/85">
              {t(`homeMap.locationName.${veh.fromKey}`)} → {t(`homeMap.locationName.${veh.toKey}`)}
            </p>
          </div>

          {veh.distanceKm > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <p className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider text-white/40">
                  <Gauge className="h-3 w-3" /> {t("vehicle.distance")}
                </p>
                <p className="mt-0.5 font-mono text-base font-semibold text-white">{Math.round(veh.distanceKm)} km</p>
              </div>
              <div className="rounded-xl bg-white/[0.04] p-2.5">
                <p className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-wider text-white/40">
                  <Clock className="h-3 w-3" /> {t("vehicle.eta")}
                </p>
                <p className="mt-0.5 font-mono text-base font-semibold text-cyan-300">
                  {veh.etaMinutes} {t("vehicle.minutes")}
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-1.5 text-xs text-white/45">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t("vehicle.dailyActivity", { n: veh.locationsVisitedToday })}
          </div>
          <p className="mt-3 text-[0.65rem] leading-relaxed text-white/30">{t("vehicle.simNote")}</p>
        </div>
      )}
    </div>
  );
}
