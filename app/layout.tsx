import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
});

// themeColor va en viewport (no en metadata) desde Next.js 14.1
export const viewport: Viewport = {
  themeColor: "#FF7A45",
};

export const metadata: Metadata = {
  title: "FlashEnglish",
  description: "Practica inglés oral cada día",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FlashEnglish",
  },
  openGraph: {
    title: "FlashEnglish - GoToEnglish",
    description: "Practica inglés oral cada día",
    url: "https://flashenglish-zeta.vercel.app",
    siteName: "FlashEnglish",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "es_ES",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
