// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — RPC Provider with Rotation & Health
// Auto-rotates between BSC RPC endpoints on failure
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";

interface RPCEndpoint {
  url: string;
  label: string;
  priority: number;
  healthy: boolean;
  lastCheck: number;
  failCount: number;
}

const BSC_MAINNET_RPCS: RPCEndpoint[] = [
  { url: "https://bsc-dataseed1.bnbchain.org", label: "BNBChain 1", priority: 1, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://bsc-dataseed2.bnbchain.org", label: "BNBChain 2", priority: 2, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://bsc.publicnode.com", label: "PublicNode", priority: 3, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://bsc-dataseed1.defibit.io", label: "DeFiBit", priority: 4, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://bsc-dataseed1.ninicoin.io", label: "NiniCoin", priority: 5, healthy: true, lastCheck: 0, failCount: 0 },
];

const BSC_TESTNET_RPCS: RPCEndpoint[] = [
  { url: "https://bsc-testnet.publicnode.com", label: "PublicNode Testnet", priority: 1, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545", label: "BNBChain Testnet 1", priority: 2, healthy: true, lastCheck: 0, failCount: 0 },
  { url: "https://data-seed-prebsc-2-s1.bnbchain.org:8545", label: "BNBChain Testnet 2", priority: 3, healthy: true, lastCheck: 0, failCount: 0 },
];

const HEALTH_CHECK_INTERVAL = 60_000; // 1 minute
const MAX_FAIL_COUNT = 3;

export class RPCProviderManager {
  private endpoints: RPCEndpoint[];
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private currentIndex = 0;

  constructor(network: "mainnet" | "testnet" = "mainnet") {
    this.endpoints = network === "mainnet" ? [...BSC_MAINNET_RPCS] : [...BSC_TESTNET_RPCS];
    console.log(`[RPC] Provider manager initialized (${network}, ${this.endpoints.length} endpoints)`);
  }

  /**
   * Get the best available provider, rotating on failure
   */
  getProvider(): ethers.JsonRpcProvider {
    const healthy = this.endpoints.filter(e => e.healthy);
    if (healthy.length === 0) {
      // Reset all endpoints if everything is down
      this.endpoints.forEach(e => { e.healthy = true; e.failCount = 0; });
      console.warn("[RPC] All endpoints were unhealthy, resetting all");
    }

    const endpoint = this.endpoints.find(e => e.healthy) || this.endpoints[0];

    let provider = this.providers.get(endpoint.url);
    if (!provider) {
      provider = new ethers.JsonRpcProvider(endpoint.url);
      this.providers.set(endpoint.url, provider);
    }

    return provider;
  }

  /**
   * Report a failure and rotate to next provider
   */
  reportFailure(providerUrl?: string): ethers.JsonRpcProvider {
    const url = providerUrl || this.endpoints[this.currentIndex]?.url;
    const endpoint = this.endpoints.find(e => e.url === url);

    if (endpoint) {
      endpoint.failCount++;
      if (endpoint.failCount >= MAX_FAIL_COUNT) {
        endpoint.healthy = false;
        endpoint.lastCheck = Date.now();
        console.warn(`[RPC] Endpoint ${endpoint.label} marked unhealthy after ${MAX_FAIL_COUNT} failures`);
      }
    }

    // Move to next healthy endpoint
    this.currentIndex = (this.currentIndex + 1) % this.endpoints.length;
    return this.getProvider();
  }

  /**
   * Execute a call with automatic retry and provider rotation
   */
  async withRetry<T>(fn: (provider: ethers.JsonRpcProvider) => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const provider = this.getProvider();
      try {
        return await fn(provider);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[RPC] Attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`);
        this.reportFailure(undefined);
      }
    }

    throw lastError || new Error("All RPC retries exhausted");
  }

  /**
   * Health check all endpoints
   */
  async healthCheck(): Promise<void> {
    const checks = this.endpoints.map(async (endpoint) => {
      if (!endpoint.healthy && Date.now() - endpoint.lastCheck < HEALTH_CHECK_INTERVAL) {
        return; // Don't recheck too frequently
      }

      try {
        let provider = this.providers.get(endpoint.url);
        if (!provider) {
          provider = new ethers.JsonRpcProvider(endpoint.url);
          this.providers.set(endpoint.url, provider);
        }

        const blockNumber = await Promise.race([
          provider.getBlockNumber(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("timeout")), 5000)
          ),
        ]);

        endpoint.healthy = true;
        endpoint.failCount = 0;
        endpoint.lastCheck = Date.now();
      } catch {
        endpoint.healthy = false;
        endpoint.lastCheck = Date.now();
      }
    });

    await Promise.allSettled(checks);

    const healthyCount = this.endpoints.filter(e => e.healthy).length;
    console.log(`[RPC] Health check: ${healthyCount}/${this.endpoints.length} endpoints healthy`);
  }

  getStatus(): { label: string; healthy: boolean; failCount: number }[] {
    return this.endpoints.map(e => ({
      label: e.label,
      healthy: e.healthy,
      failCount: e.failCount,
    }));
  }
}
