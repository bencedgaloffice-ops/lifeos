import { pointAlongRoute, routeLengthKm, type LonLat } from "./vehicle-routes";

export type VehicleStatus = "driving" | "working" | "arrived" | "waiting" | "returning";

type MissionLeg = {
  kind: "drive" | "work" | "wait";
  from: string;
  to: string;
  routeKey: string | null;
  missionKey: string;
  /** How long this leg plays in the simulation loop, in seconds. */
  simSeconds: number;
  /** The real-world duration this leg represents, in minutes — used only
   * for the ETA readout, decoupled from the compressed simSeconds so the
   * loop stays watchable while the numbers still read as plausible. */
  realMinutes: number;
};

/** Fixed points a leg can start/end at — real coordinates, matching the
 * Location clusters and the ICSB work site referenced by the routes. */
export const WAYPOINTS: Record<string, LonLat> = {
  diosd: [18.868, 47.394],
  icsb: [19.04, 47.498],
  budapest: [19.0402, 47.4979],
  somogy: [17.797, 46.359],
  germany: [17.1264, 47.9139],
};

/** One continuously-repeating simulated day. A real tracking integration
 * would replace this whole schedule with live positions — every consumer
 * (the 3D vehicle, the click panel) only ever reads computeVehicleState's
 * output, so that swap wouldn't touch anything downstream. */
const SCHEDULE: MissionLeg[] = [
  { kind: "drive", from: "diosd", to: "icsb", routeKey: "diosd-icsb", missionKey: "securityShift", simSeconds: 35, realMinutes: 22 },
  { kind: "work", from: "icsb", to: "icsb", routeKey: null, missionKey: "securityShift", simSeconds: 70, realMinutes: 0 },
  { kind: "drive", from: "icsb", to: "diosd", routeKey: "diosd-icsb", missionKey: "returningHome", simSeconds: 35, realMinutes: 22 },
  { kind: "wait", from: "diosd", to: "diosd", routeKey: null, missionKey: "atHomeBase", simSeconds: 25, realMinutes: 0 },
  { kind: "drive", from: "diosd", to: "somogy", routeKey: "diosd-somogy", missionKey: "farmVisit", simSeconds: 65, realMinutes: 130 },
  { kind: "work", from: "somogy", to: "somogy", routeKey: null, missionKey: "beekeepingCheck", simSeconds: 55, realMinutes: 0 },
  { kind: "drive", from: "somogy", to: "diosd", routeKey: "diosd-somogy", missionKey: "returningHome", simSeconds: 65, realMinutes: 130 },
  { kind: "wait", from: "diosd", to: "diosd", routeKey: null, missionKey: "atHomeBase", simSeconds: 25, realMinutes: 0 },
  { kind: "drive", from: "diosd", to: "budapest", routeKey: "diosd-budapest", missionKey: "businessTrip", simSeconds: 25, realMinutes: 18 },
  { kind: "work", from: "budapest", to: "budapest", routeKey: null, missionKey: "financeMeetings", simSeconds: 50, realMinutes: 0 },
  { kind: "drive", from: "budapest", to: "diosd", routeKey: "diosd-budapest", missionKey: "returningHome", simSeconds: 25, realMinutes: 18 },
  { kind: "wait", from: "diosd", to: "diosd", routeKey: null, missionKey: "atHomeBase", simSeconds: 30, realMinutes: 0 },
  { kind: "drive", from: "diosd", to: "germany", routeKey: "diosd-germany", missionKey: "importRun", simSeconds: 85, realMinutes: 165 },
  { kind: "work", from: "germany", to: "germany", routeKey: null, missionKey: "importPickup", simSeconds: 60, realMinutes: 0 },
  { kind: "drive", from: "germany", to: "diosd", routeKey: "diosd-germany", missionKey: "returningHome", simSeconds: 85, realMinutes: 165 },
  { kind: "wait", from: "diosd", to: "diosd", routeKey: null, missionKey: "atHomeBase", simSeconds: 35, realMinutes: 0 },
];

const TOTAL_CYCLE_SECONDS = SCHEDULE.reduce((s, leg) => s + leg.simSeconds, 0);

/** A fixed epoch so every viewer's clock agrees on where the vehicle is
 * right now — it's one shared simulation, not a per-session random walk. */
const EPOCH_MS = Date.UTC(2026, 0, 1);

export type VehicleState = {
  position: LonLat;
  status: VehicleStatus;
  missionKey: string;
  fromKey: string;
  toKey: string;
  distanceKm: number;
  etaMinutes: number;
  locationsVisitedToday: number;
  /** Ease-in/out speed factor (0..1) — near 0 at the start/end of a drive
   * leg (accelerating/braking), near 1 mid-route at full speed. */
  speedFactor: number;
  /** True during the compressed "night" third of the loop — drives the
   * headlights and a brighter glowing trail. */
  isNight: boolean;
};

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Smooth speed ramp: slow near both ends of a drive leg (approaching a
 * turn/destination or just pulling away), fastest through the middle. */
function speedRamp(t: number): number {
  const rampZone = 0.15;
  if (t < rampZone) return easeInOutCubic(t / rampZone);
  if (t > 1 - rampZone) return easeInOutCubic((1 - t) / rampZone);
  return 1;
}

export function computeVehicleState(nowMs: number = Date.now()): VehicleState {
  const elapsed = ((nowMs - EPOCH_MS) / 1000) % TOTAL_CYCLE_SECONDS;
  const cyclePos = elapsed < 0 ? elapsed + TOTAL_CYCLE_SECONDS : elapsed;

  let cursor = 0;
  let legIndex = 0;
  let tWithinLeg = 0;
  for (let i = 0; i < SCHEDULE.length; i++) {
    const leg = SCHEDULE[i];
    if (cyclePos < cursor + leg.simSeconds || i === SCHEDULE.length - 1) {
      legIndex = i;
      tWithinLeg = leg.simSeconds > 0 ? (cyclePos - cursor) / leg.simSeconds : 0;
      break;
    }
    cursor += leg.simSeconds;
  }
  const leg = SCHEDULE[legIndex];

  let position: LonLat;
  let status: VehicleStatus;
  let distanceKm = 0;
  let etaMinutes = 0;
  let speedFactor = 0;

  if (leg.kind === "drive") {
    const eased = easeInOutCubic(tWithinLeg);
    position = leg.routeKey ? pointAlongRoute(leg.routeKey, eased) : WAYPOINTS[leg.to];
    status = leg.missionKey === "returningHome" ? "returning" : "driving";
    distanceKm = leg.routeKey ? routeLengthKm(leg.routeKey) : 0;
    etaMinutes = Math.max(1, Math.round((1 - tWithinLeg) * leg.realMinutes));
    speedFactor = speedRamp(tWithinLeg);
  } else {
    position = WAYPOINTS[leg.to] ?? WAYPOINTS[leg.from];
    // Reads as "arrived" for the first slice of a work/wait leg, then
    // settles into the steady-state status for the rest of it.
    const justArrived = tWithinLeg < 0.08;
    status = justArrived ? "arrived" : leg.kind === "work" ? "working" : "waiting";
    speedFactor = 0;
  }

  // "Locations visited today" — distinct destinations reached by drive legs
  // completed so far in this loop iteration (a full lap resets the count).
  const visited = new Set<string>();
  for (let i = 0; i <= legIndex; i++) {
    const l = SCHEDULE[i];
    if (l.kind === "drive" && (i < legIndex || tWithinLeg > 0.95)) visited.add(l.to);
  }

  const dayFraction = cyclePos / TOTAL_CYCLE_SECONDS;
  const isNight = dayFraction > 0.66 && dayFraction < 0.92;

  return {
    position,
    status,
    missionKey: leg.missionKey,
    fromKey: leg.from,
    toKey: leg.to,
    distanceKm,
    etaMinutes,
    locationsVisitedToday: visited.size,
    speedFactor,
    isNight,
  };
}
