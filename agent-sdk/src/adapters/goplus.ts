import type { IScanner } from "../interfaces";
import type { ScanResult } from "../types";

interface GoPlusResponse {
  result: Record<string, {
    is_honeypot?: string;
    buy_tax?: string;
    sell_tax?: string;
    holder_count?: string;
    is_open_source?: string;
    owner_percent?: string;
    lp_total_supply?: string;
    is_mintable?: string;
    can_take_back_ownership?: string;
    is_proxy?: string;
    slippage_modifiable?: string;
    transfer_pausable?: string;
    is_blacklisted?: string;
  }>;
}

/**
 * GoPlusAdapter — Scanner that queries the GoPlusLabs security API.
 * Free tier, no API key required. Rate-limited to ~5 req/s.
 */
export class GoPlusAdapter implements IScanner {
  name = "GoPlusLabs";
  private chainId: number;

  constructor(chainId: number = 56) {
    this.chainId = chainId;
  }

  async scan(tokenAddress: string): Promise<ScanResult> {
    const url = `https://api.gopluslabs.com/api/v1/token_security/${this.chainId}?contract_addresses=${tokenAddress}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.status}`);
    }

    const data = (await response.json()) as GoPlusResponse;
    const info = data.result[tokenAddress.toLowerCase()];

    if (!info) {
      throw new Error(`No GoPlus data for ${tokenAddress}`);
    }

    const isHoneypot = info.is_honeypot === "1";
    const buyTax = Math.round(parseFloat(info.buy_tax ?? "0") * 10000);
    const sellTax = Math.round(parseFloat(info.sell_tax ?? "0") * 10000);
    const holderCount = parseInt(info.holder_count ?? "0", 10);
    const isVerified = info.is_open_source === "1";
    const topHolderPercent = Math.round(parseFloat(info.owner_percent ?? "0") * 10000);
    const isMintable = info.is_mintable === "1";
    const canPause = info.transfer_pausable === "1";
    const canBlacklist = info.is_blacklisted === "1";

    // Compute risk score (heuristic)
    let riskScore = 0;
    if (isHoneypot) riskScore += 50;
    if (buyTax > 1000) riskScore += 15;
    if (sellTax > 1000) riskScore += 15;
    if (!isVerified) riskScore += 10;
    if (topHolderPercent > 5000) riskScore += 10;
    if (isMintable) riskScore += 5;
    riskScore = Math.min(100, riskScore);

    return {
      token: tokenAddress,
      riskScore,
      liquidity: BigInt(0), // GoPlus doesn't provide exact LP value
      holderCount,
      topHolderPercent,
      buyTax,
      sellTax,
      isHoneypot,
      ownerCanMint: isMintable,
      ownerCanPause: canPause,
      ownerCanBlacklist: canBlacklist,
      isContractRenounced: info.can_take_back_ownership !== "1",
      isLiquidityLocked: false, // Not available from GoPlus directly
      isVerified,
    };
  }
}
