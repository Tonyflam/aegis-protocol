// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Type Definitions Tests
// Verifies all type constants and enums are correctly defined
// ═══════════════════════════════════════════════════════════════

import {
  KNOWN_EXCHANGES,
  KNOWN_DEX_ROUTERS,
  DEAD_ADDRESSES,
  BSC_TOKENS,
  SAFE_TOKENS,
} from "../types";

describe("Type Constants", () => {
  test("KNOWN_EXCHANGES should contain Binance hot wallets", () => {
    // Binance Hot Wallet 3
    expect(KNOWN_EXCHANGES).toHaveProperty("0x8894e0a0c962cb723c1ef8f1d0dea26f46f2efed");
  });

  test("KNOWN_DEX_ROUTERS should contain PancakeSwap V2", () => {
    expect(KNOWN_DEX_ROUTERS).toHaveProperty("0x10ed43c718714eb63d5aa57b78b54704e256024e");
  });

  test("DEAD_ADDRESSES should contain zero address", () => {
    expect(DEAD_ADDRESSES.has("0x0000000000000000000000000000000000000000")).toBe(true);
  });

  test("BSC_TOKENS should contain WBNB", () => {
    expect(BSC_TOKENS.WBNB).toBe("0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c");
  });

  test("BSC_TOKENS should contain BUSD and USDT", () => {
    expect(BSC_TOKENS.BUSD).toBeDefined();
    expect(BSC_TOKENS.USDT).toBeDefined();
  });

  test("SAFE_TOKENS should be a set of known safe addresses", () => {
    expect(SAFE_TOKENS.size).toBeGreaterThan(0);
    // WBNB should be in safe tokens
    expect(SAFE_TOKENS.has(BSC_TOKENS.WBNB.toLowerCase())).toBe(true);
  });

  test("All exchange addresses should be lowercase", () => {
    for (const addr of Object.keys(KNOWN_EXCHANGES)) {
      expect(addr).toBe(addr.toLowerCase());
    }
  });

  test("All DEX router addresses should be lowercase", () => {
    for (const addr of Object.keys(KNOWN_DEX_ROUTERS)) {
      expect(addr).toBe(addr.toLowerCase());
    }
  });
});
