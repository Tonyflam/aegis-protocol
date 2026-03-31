"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface WalletState {
  address: string | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.Signer | null;
  chainId: number | null;
  isConnecting: boolean;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBsc: () => Promise<void>;
}

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const disconnect = useCallback(async () => {
    // Revoke MetaMask permissions so next connect requires approval
    try {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        // Remove event listeners to prevent stale handlers
        ethereum.removeAllListeners?.("accountsChanged");
        ethereum.removeAllListeners?.("chainChanged");
        // Revoke wallet permissions (MetaMask 11.4+)
        await ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        }).catch(() => {
          // Fallback: not all wallets support revokePermissions
        });
      }
    } catch {
      // Silent — disconnect UI state regardless
    }
    setAddress(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    toast.success("Wallet disconnected");
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      toast.error("Please install MetaMask or a compatible wallet");
      return;
    }
    setIsConnecting(true);
    try {
      const ethereum = (window as any).ethereum;
      const prov = new ethers.BrowserProvider(ethereum);
      await prov.send("eth_requestAccounts", []);
      const sig = await prov.getSigner();
      const addr = await sig.getAddress();
      const network = await prov.getNetwork();
      setProvider(prov);
      setSigner(sig);
      setAddress(addr);
      setChainId(Number(network.chainId));
      toast.success(`Connected: ${addr.slice(0, 6)}...${addr.slice(-4)}`);

      ethereum.on("accountsChanged", (accounts: string[]) => {
        if (accounts.length === 0) disconnect();
        else setAddress(accounts[0]);
      });
      ethereum.on("chainChanged", () => window.location.reload());
    } catch (error: any) {
      toast.error(error.message || "Failed to connect wallet");
    } finally {
      setIsConnecting(false);
    }
  }, [disconnect]);

  const switchToBsc = useCallback(async () => {
    if (!(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x61" }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x61",
            chainName: "BNB Smart Chain Testnet",
            nativeCurrency: { name: "tBNB", symbol: "tBNB", decimals: 18 },
            rpcUrls: ["https://data-seed-prebsc-1-s1.binance.org:8545"],
            blockExplorerUrls: ["https://testnet.bscscan.com"],
          }],
        });
      }
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      address, provider, signer, chainId, isConnecting,
      isConnected: !!address, connect, disconnect, switchToBsc,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletContext() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWalletContext must be used within WalletProvider");
  return ctx;
}
