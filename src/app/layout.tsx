import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

export const metadata: Metadata = {
  title: "Evac: fire exit for NEAR DeFi",
  description:
    "The website is hijacked or gone, but your money is still in the contracts. Evac is the way out that never goes through the front door: read your position straight from the NEAR contracts and withdraw safely.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
