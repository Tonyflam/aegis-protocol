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
  title: "Aegis Protocol — On-Chain Security Oracle for BNB Chain",
  description:
    "The programmable security data layer for BNB Chain. On-chain token risk scoring, honeypot detection, multi-agent consensus oracle. Any smart contract can query isTokenSafe() before executing.",
  keywords: ["Security Oracle", "BNB Chain", "Token Scanner", "Honeypot Detection", "Smart Contract Security", "DeFi Security", "On-Chain Oracle"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "Aegis Protocol — On-Chain Security Oracle for BNB Chain",
    description: "The programmable security data layer for BNB Chain. On-chain token risk scoring, multi-agent consensus, contract-queryable oracle.",
    url: "https://aegisguardian.xyz",
    siteName: "Aegis Protocol",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis Protocol — AI-Powered DeFi Guardian" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis Protocol — On-Chain Security Oracle for BNB Chain",
    description: "The programmable security data layer for BNB Chain. On-chain token risk scoring, multi-agent consensus, contract-queryable oracle.",
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
