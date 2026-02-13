import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Baby Name Rater | Noah Shaw",
  description:
    "A collaborative app for couples to rate and discover baby names together.",
};

export default function BabyNameRaterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
