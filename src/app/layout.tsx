import type { Metadata } from "next";
import { Inter, Orbitron, Rajdhani } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-rajdhani",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://kapitan.ezos.my"),
  title: "KAPITAN SIGNAL",
  description: "Every Signal Is A Mission.",
  icons: {
    icon: [
      { url: "/kapitan-logo.png", type: "image/png" },
    ],
    shortcut: "/kapitan-logo.png",
    apple: "/kapitan-logo.png",
  },
  openGraph: {
    title: "KAPITAN SIGNAL",
    description: "Every Signal Is A Mission.",
    url: "https://kapitan.ezos.my",
    siteName: "KAPITAN SIGNAL",
    images: [
      {
        url: "/kapitan-logo.png",
        width: 1200,
        height: 1200,
        alt: "KAPITAN SIGNAL",
      },
    ],
    locale: "ms_MY",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KAPITAN SIGNAL",
    description: "Every Signal Is A Mission.",
    images: ["/kapitan-logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ms" className={`${inter.variable} ${orbitron.variable} ${rajdhani.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
