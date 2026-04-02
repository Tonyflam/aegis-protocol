// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — RPC Provider Tests
// ═══════════════════════════════════════════════════════════════

import { RPCProviderManager } from "../providers/rpc";

describe("RPCProviderManager", () => {
  let manager: RPCProviderManager;

  beforeEach(() => {
    manager = new RPCProviderManager("mainnet");
  });

  test("should initialize with mainnet endpoints", () => {
    const status = manager.getStatus();
    expect(Array.isArray(status)).toBe(true);
    expect(status.length).toBeGreaterThan(0);
    expect(status.every(s => s.healthy)).toBe(true);
  });

  test("should return a provider", () => {
    const provider = manager.getProvider();
    expect(provider).toBeDefined();
  });

  test("should support testnet", () => {
    const testnet = new RPCProviderManager("testnet");
    const status = testnet.getStatus();
    expect(Array.isArray(status)).toBe(true);
    expect(status.length).toBeGreaterThan(0);
  });

  test("should return status with label, healthy, and failCount", () => {
    const status = manager.getStatus();
    for (const ep of status) {
      expect(ep).toHaveProperty("label");
      expect(ep).toHaveProperty("healthy");
      expect(ep).toHaveProperty("failCount");
      expect(ep.failCount).toBe(0);
    }
  });
});
