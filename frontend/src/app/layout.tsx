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
  title: "Aegis Scanner — The Safety Oracle for BNB Chain",
  description:
    "Like Chainlink for price feeds, but for token safety. Scan any BNB Chain token for honeypots, rug risks, and hidden flags. On-chain oracle — any smart contract can call isTokenSafe().",
  keywords: ["Safety Oracle", "BNB Chain", "Token Scanner", "Honeypot Detection", "DeFi Safety", "On-Chain Oracle", "AegisScanner"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "Aegis Scanner — The Safety Oracle for BNB Chain",
    description: "Like Chainlink for price feeds, but for token safety. Scan any BNB Chain token instantly. On-chain oracle any contract can query.",
    url: "https://aegisguardian.xyz",
    siteName: "Aegis Scanner",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis Scanner — The Safety Oracle for BNB Chain" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis Scanner — The Safety Oracle for BNB Chain",
    description: "Like Chainlink for price feeds, but for token safety. Scan any BNB Chain token instantly. On-chain oracle any contract can query.",
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
