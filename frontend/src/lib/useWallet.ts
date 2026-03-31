/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useCallback } from "react";
import { ethers } from "ethers";
import toast from "react-hot-toast";

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const disconnect = useCallback(async () => {
    try {
      const ethereum = (window as any).ethereum;
      if (ethereum) {
        ethereum.removeAllListeners?.("accountsChanged");
        ethereum.removeAllListeners?.("chainChanged");
        await ethereum.request({
          method: "wallet_revokePermissions",
          params: [{ eth_accounts: {} }],
        }).catch(() => {});
      }
    } catch {
      // Silent
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
        if (accounts.length === 0) {
          disconnect();
        } else {
          setAddress(accounts[0]);
        }
      });

      ethereum.on("chainChanged", () => {
        window.location.reload();
      });
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

  return {
    address,
    provider,
    signer,
    chainId,
    isConnecting,
    connect,
    disconnect,
    switchToBsc,
    isConnected: !!address,
  };
}
