import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Night Sky | Noah Shaw",
  description:
    "Type any address to see the constellations, planets, sun, and moon overhead. Pan, zoom, and search the sky from your browser.",
  openGraph: {
    title: "Night Sky",
    description:
      "An interactive star chart for any address on Earth. Constellations, planets, sun, and moon, computed in your browser.",
    type: "website",
  },
};

export default function SkyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
