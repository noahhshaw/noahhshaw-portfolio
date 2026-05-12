import type { ReactNode } from "react";

export const metadata = {
  title: "Daily Bay Baby",
  description: "Daily baby agent for Noah and Anoushka.",
};

export default function BabyLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
