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
  title: "Aegis Guardian — AI Wallet Security on BNB Chain",
  description:
    "AI-powered wallet bodyguard for BNB Chain. Scans token approvals, risk-scores contracts, auto-revokes dangerous permissions, and guards your wallet 24/7.",
  keywords: ["Wallet Security", "AI Agent", "BNB Chain", "Token Approvals", "Revoke", "DeFi Security", "Smart Contract", "BSC"],
  authors: [{ name: "Uniq Minds" }],
  openGraph: {
    title: "Aegis Guardian — AI Wallet Security on BNB Chain",
    description: "AI-powered wallet bodyguard. Scans approvals, detects threats, auto-revokes dangerous permissions on BNB Chain.",
    url: "https://aegisguardian.xyz",
    siteName: "Aegis Guardian",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og-image.svg", width: 1200, height: 630, alt: "Aegis Guardian — AI Wallet Security" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aegis Guardian — AI Wallet Security on BNB Chain",
    description: "AI-powered wallet bodyguard. Scans approvals, detects threats, auto-revokes dangerous permissions. $UNIQ token utility.",
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
