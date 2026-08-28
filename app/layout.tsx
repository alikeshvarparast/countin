import type { Metadata, Viewport } from "next";
import { Fraunces, Outfit } from "next/font/google";
import localFont from "next/font/local";
import { APP_NAME } from "@/lib/brand";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

const bNazanin = localFont({
  src: [
    { path: "./fonts/nazli.ttf", weight: "400", style: "normal" },
    { path: "./fonts/nazlib.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-b-nazanin",
  display: "swap",
  adjustFontFallback: false,
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0600-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF",
    },
  ],
});

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: `${APP_NAME} helps groups run recurring sessions with RSVPs, waitlists, and a shared ledger.`,
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F4EFE8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable} ${bNazanin.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
