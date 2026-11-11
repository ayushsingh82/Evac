import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import "./globals.css";

const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-inter-tight", display: "swap" });

const DESCRIPTION =
  "Website hijacked or gone? Your funds are still on chain. Evac reads your position from the NEAR contracts and withdraws it safely.";

export const metadata: Metadata = {
  metadataBase: new URL("https://getevac.vercel.app"),
  title: "Evac: fire exit for NEAR DeFi",
  description: DESCRIPTION,
  openGraph: { title: "Evac: fire exit for NEAR DeFi", description: DESCRIPTION, url: "https://getevac.vercel.app", siteName: "Evac", type: "website" },
  twitter: { card: "summary", title: "Evac: fire exit for NEAR DeFi", description: DESCRIPTION },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}
