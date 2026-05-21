import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  if (!q) return NextResponse.json({ error: "missing q" }, { status: 400 });
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: {
      "User-Agent": "noahhshaw-portfolio-sky/1.0 (noahhshaw@gmail.com)",
      "Accept-Language": "en",
    },
  });
  if (!r.ok) return NextResponse.json({ error: "geocode failed" }, { status: 502 });
  const data = (await r.json()) as Array<{ lat: string; lon: string; display_name: string }>;
  if (!data.length) return NextResponse.json({ error: "no results" }, { status: 404 });
  const top = data[0];
  return NextResponse.json({
    lat: parseFloat(top.lat),
    lon: parseFloat(top.lon),
    label: top.display_name,
  });
}
