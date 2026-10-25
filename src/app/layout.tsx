import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cold Chain Monitoring & Kinetic Viability Engine | Agesichain",
  description: "Real-time vaccine viability dashboard powered by Arrhenius kinetics & IoT telemetry",
};

import { Providers } from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <head>
        {/* MapLibre GL CSS — required by the Krutrim (Ola Maps) Web SDK */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[#0c0d0f] text-neutral-100 selection:bg-neutral-700/60 selection:text-white">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

