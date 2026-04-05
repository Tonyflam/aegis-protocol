import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientLayout from "../components/ClientLayout";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://aegisguardian.xyz"),
  title: "Aegis — BNB Chain Token Safety Scanner",
  description:
    "Scan any BNB Chain token for honeypots, rug pulls, and hidden taxes. Free, open source, results stored on-chain. Built by Uniq Minds.",
  keywords: ["BNB Chain", "Token Scanner", "Honeypot Detection", "Rug Pull Checker", "BSC Token Safety", "DeFi Security"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "Aegis — BNB Chain Token Safety Scanner",
    description: "Check any BSC token for honeypots, rug pulls, and hidden taxes. Free. Open source. On-chain.",
    url: "https://aegisguardian.xyz",
    siteName: "Aegis",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis — BNB Chain Token Safety Scanner" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis — BNB Chain Token Safety Scanner",
    description: "Check any BSC token for honeypots, rug pulls, and hidden taxes. Free. Open source. On-chain.",
    images: ["/og-image.svg"],
  },
  icons: {
    icon: "/favicon.svg",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <head>
        <meta name="theme-color" content="#0a0e17" />
      </head>
      <body className={`${inter.className} bg-[#0a0e17] text-white antialiased min-h-screen`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
