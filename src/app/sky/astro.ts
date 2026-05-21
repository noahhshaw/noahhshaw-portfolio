// Equatorial -> horizontal coords + sun/moon/planet positions.
import * as Astronomy from "astronomy-engine";

export type EqCoord = { raDeg: number; decDeg: number };
export type HorizCoord = { altDeg: number; azDeg: number };

const DEG = Math.PI / 180;

// Greenwich Mean Sidereal Time in hours, then convert to degrees.
function gmstDeg(date: Date): number {
  // astronomy-engine provides SiderealTime in sidereal hours at Greenwich.
  const t = new Astronomy.AstroTime(date);
  const gmstHours = Astronomy.SiderealTime(t); // 0..24
  return (gmstHours * 15) % 360;
}

export function eqToHoriz(eq: EqCoord, latDeg: number, lonDeg: number, date: Date): HorizCoord {
  const gmst = gmstDeg(date);
  // Local sidereal time
  const lst = ((gmst + lonDeg) % 360 + 360) % 360;
  const ha = ((lst - eq.raDeg) % 360 + 360) % 360; // hour angle in degrees
  const haRad = ha * DEG;
  const decRad = eq.decDeg * DEG;
  const latRad = latDeg * DEG;
  const sinAlt =
    Math.sin(decRad) * Math.sin(latRad) +
    Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
  const alt = Math.asin(sinAlt);
  const cosAz =
    (Math.sin(decRad) - Math.sin(alt) * Math.sin(latRad)) /
    (Math.cos(alt) * Math.cos(latRad));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (Math.sin(haRad) > 0) az = 2 * Math.PI - az;
  return { altDeg: alt / DEG, azDeg: (az / DEG) % 360 };
}

export type Body = {
  name: string;
  ra: number; // degrees
  dec: number; // degrees
  magnitude: number;
  kind: "sun" | "moon" | "planet";
};

const PLANETS: Astronomy.Body[] = [
  Astronomy.Body.Mercury,
  Astronomy.Body.Venus,
  Astronomy.Body.Mars,
  Astronomy.Body.Jupiter,
  Astronomy.Body.Saturn,
  Astronomy.Body.Uranus,
  Astronomy.Body.Neptune,
];

export function bodiesAt(date: Date, latDeg: number, lonDeg: number): Body[] {
  const observer = new Astronomy.Observer(latDeg, lonDeg, 0);
  const out: Body[] = [];
  const make = (name: string, body: Astronomy.Body, kind: Body["kind"]) => {
    const equ = Astronomy.Equator(body, date, observer, true, true);
    let mag = 0;
    try {
      const info = Astronomy.Illumination(body, date);
      mag = info.mag;
    } catch {
      mag = -10;
    }
    out.push({ name, ra: equ.ra * 15, dec: equ.dec, magnitude: mag, kind });
  };
  make("Sun", Astronomy.Body.Sun, "sun");
  make("Moon", Astronomy.Body.Moon, "moon");
  const labels = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
  PLANETS.forEach((p, i) => make(labels[i], p, "planet"));
  return out;
}

export function moonPhase(date: Date): number {
  // 0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
  return Astronomy.MoonPhase(date) / 360;
}
