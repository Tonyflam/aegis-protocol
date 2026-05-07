"use client";

import { WalletProvider } from "../lib/WalletContext";
import { Toaster } from "react-hot-toast";
import { usePathname } from "next/navigation";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  // Phase 4: re-key main on route change so the page-enter animation runs
  // each navigation, giving the app a real "page transition" feel.
  const pathname = usePathname();
  return (
    <WalletProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#1a1f2e",
            color: "#e2e8f0",
            border: "1px solid rgba(0, 224, 255, 0.2)",
          },
        }}
      />
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main key={pathname} className="flex-1 page-enter">{children}</main>
        <Footer />
      </div>
    </WalletProvider>
  );
}
