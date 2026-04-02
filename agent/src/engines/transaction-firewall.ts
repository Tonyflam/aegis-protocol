// ═══════════════════════════════════════════════════════════════
// Aegis Security OS — Transaction Firewall Engine
// Pre-sign transaction simulation and risk assessment
// Decodes calldata, simulates balance/approval changes,
// and flags dangerous transactions before signing
// ═══════════════════════════════════════════════════════════════

import { ethers } from "ethers";
import {
  TransactionSimulation, BalanceChange, ApprovalChange,
  ApprovalRiskLevel, EngineResult, KNOWN_DEX_ROUTERS, KNOWN_EXCHANGES,
} from "../types";
import { PersistenceLayer } from "../persistence";
import { RPCProviderManager } from "../providers/rpc";

// Common function selectors for decoding
const SELECTORS: Record<string, { name: string; sig: string }> = {
  "0x095ea7b3": { name: "approve", sig: "approve(address,uint256)" },
  "0xa9059cbb": { name: "transfer", sig: "transfer(address,uint256)" },
  "0x23b872dd": { name: "transferFrom", sig: "transferFrom(address,address,uint256)" },
  "0x38ed1739": { name: "swapExactTokensForTokens", sig: "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)" },
  "0x8803dbee": { name: "swapTokensForExactTokens", sig: "swapTokensForExactTokens(uint256,uint256,address[],address,uint256)" },
  "0x7ff36ab5": { name: "swapExactETHForTokens", sig: "swapExactETHForTokens(uint256,address[],address,uint256)" },
  "0x18cbafe5": { name: "swapExactTokensForETH", sig: "swapExactTokensForETH(uint256,uint256,address[],address,uint256)" },
  "0xfb3bdb41": { name: "swapETHForExactTokens", sig: "swapETHForExactTokens(uint256,address[],address,uint256)" },
};

const ERC20_IFACE = new ethers.Interface([
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
  "function transferFrom(address from, address to, uint256 amount)",
]);

export class TransactionFirewallEngine {
  private rpc: RPCProviderManager;
  private db: PersistenceLayer;

  constructor(rpc: RPCProviderManager, db: PersistenceLayer) {
    this.rpc = rpc;
    this.db = db;
    console.log("[TxFirewall] Engine initialized");
  }

  /**
   * Simulate a transaction and assess risk before signing
   */
  async simulate(tx: {
    to: string; from: string; data: string; value: string; chainId?: number;
  }): Promise<EngineResult<TransactionSimulation>> {
    const start = Date.now();

    try {
      const result = await this.rpc.withRetry(async (provider) => {
        // 1. Decode the transaction
        const decoded = this.decodeTx(tx.to, tx.data);

        // 2. Estimate gas (also validates the tx would succeed)
        let gasEstimate = "0";
        let success = true;
        let revertReason: string | null = null;

        try {
          const estimate = await provider.estimateGas({
            to: tx.to,
            from: tx.from,
            data: tx.data,
            value: ethers.getBigInt(tx.value || "0"),
          });
          gasEstimate = estimate.toString();
        } catch (err: unknown) {
          success = false;
          revertReason = err instanceof Error ? err.message : String(err);
          // Extract revert reason from error
          const match = revertReason.match(/reason="([^"]+)"/);
          if (match) revertReason = match[1];
        }

        // 3. Analyze balance and approval changes
        const balanceChanges = this.analyzeBalanceChanges(tx, decoded);
        const approvalChanges = this.analyzeApprovalChanges(tx, decoded);

        // 4. Risk assessment
        const { riskScore, warnings } = this.assessRisk(tx, decoded, approvalChanges, balanceChanges);

        return {
          to: tx.to,
          from: tx.from,
          data: tx.data,
          value: tx.value || "0",
          chainId: tx.chainId || 56,
          gasEstimate,
          success,
          revertReason,
          balanceChanges,
          approvalChanges,
          riskScore,
          warnings,
          timestamp: Date.now(),
        } satisfies TransactionSimulation;
      });

      // Persist
      this.db.logEngineRun("tx-firewall", tx.to, true, Date.now() - start);

      return { success: true, data: result, error: null, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.db.logEngineRun("tx-firewall", tx.to, false, Date.now() - start, msg);
      return { success: false, data: null, error: msg, duration: Date.now() - start, timestamp: Date.now(), cached: false };
    }
  }

  // ─── Transaction Decoding ──────────────────────────────────

  private decodeTx(to: string, data: string): {
    functionName: string | null;
    functionSig: string | null;
    selector: string;
    args: Record<string, unknown>;
  } {
    if (!data || data.length < 10) {
      return { functionName: null, functionSig: null, selector: "0x", args: {} };
    }

    const selector = data.slice(0, 10).toLowerCase();
    const known = SELECTORS[selector];

    if (!known) {
      return { functionName: null, functionSig: null, selector, args: {} };
    }

    try {
      // Try to decode known ERC-20 functions
      if (["approve", "transfer", "transferFrom"].includes(known.name)) {
        const decoded = ERC20_IFACE.parseTransaction({ data, value: 0n });
        if (decoded) {
          const args: Record<string, unknown> = {};
          decoded.fragment.inputs.forEach((input, i) => {
            args[input.name] = decoded.args[i]?.toString();
          });
          return { functionName: known.name, functionSig: known.sig, selector, args };
        }
      }
    } catch { /* fallthrough */ }

    return { functionName: known.name, functionSig: known.sig, selector, args: {} };
  }

  // ─── Change Analysis ───────────────────────────────────────

  private analyzeBalanceChanges(
    tx: { to: string; from: string; value: string },
    decoded: { functionName: string | null; args: Record<string, unknown> }
  ): BalanceChange[] {
    const changes: BalanceChange[] = [];

    // Native BNB transfer
    const value = ethers.getBigInt(tx.value || "0");
    if (value > 0n) {
      changes.push({
        token: null,
        from: tx.from,
        to: tx.to,
        amount: ethers.formatEther(value),
        amountUsd: 0,
        direction: "OUT",
      });
    }

    // ERC-20 transfer
    if (decoded.functionName === "transfer" && decoded.args.to && decoded.args.amount) {
      changes.push({
        token: { address: tx.to, symbol: "???", name: "Unknown", decimals: 18 },
        from: tx.from,
        to: decoded.args.to as string,
        amount: decoded.args.amount as string,
        amountUsd: 0,
        direction: "OUT",
      });
    }

    return changes;
  }

  private analyzeApprovalChanges(
    tx: { to: string; from: string },
    decoded: { functionName: string | null; args: Record<string, unknown> }
  ): ApprovalChange[] {
    if (decoded.functionName !== "approve") return [];

    const spender = (decoded.args.spender || decoded.args[0] || "") as string;
    const amount = ethers.getBigInt(decoded.args.amount as string || decoded.args[1] as string || "0");
    const isUnlimited = amount >= ethers.parseEther("1000000000") || amount === ethers.MaxUint256;
    const spenderLower = spender.toLowerCase();
    const spenderLabel = KNOWN_DEX_ROUTERS[spenderLower] || KNOWN_EXCHANGES[spenderLower] || "Unknown Contract";

    let riskLevel: ApprovalRiskLevel;
    if (!isUnlimited) {
      riskLevel = ApprovalRiskLevel.LOW;
    } else if (KNOWN_DEX_ROUTERS[spenderLower]) {
      riskLevel = ApprovalRiskLevel.MEDIUM;
    } else {
      riskLevel = ApprovalRiskLevel.HIGH;
    }

    return [{
      tokenAddress: tx.to,
      tokenSymbol: "???",
      spender,
      spenderLabel,
      oldAllowance: "unknown",
      newAllowance: amount.toString(),
      isUnlimited,
      riskLevel,
    }];
  }

  // ─── Risk Assessment ───────────────────────────────────────

  private assessRisk(
    tx: { to: string; from: string; value: string; data: string },
    decoded: { functionName: string | null; selector: string; args: Record<string, unknown> },
    approvalChanges: ApprovalChange[],
    balanceChanges: BalanceChange[]
  ): { riskScore: number; warnings: string[] } {
    let riskScore = 0;
    const warnings: string[] = [];
    const toLower = tx.to.toLowerCase();

    // Unknown contract interaction
    if (!KNOWN_DEX_ROUTERS[toLower] && !KNOWN_EXCHANGES[toLower] && tx.data.length > 10) {
      riskScore += 15;
      warnings.push("Interacting with unknown contract");
    }

    // Unknown function selector
    if (tx.data.length > 10 && !decoded.functionName) {
      riskScore += 10;
      warnings.push("Unknown function call");
    }

    // Unlimited approval to unknown contract
    for (const change of approvalChanges) {
      if (change.isUnlimited && change.riskLevel === ApprovalRiskLevel.HIGH) {
        riskScore += 30;
        warnings.push(`Unlimited approval to unknown contract: ${change.spender.slice(0, 10)}...`);
      } else if (change.isUnlimited) {
        riskScore += 10;
        warnings.push(`Unlimited approval to ${change.spenderLabel}`);
      }
    }

    // Large native BNB transfer
    const value = ethers.getBigInt(tx.value || "0");
    if (value > ethers.parseEther("10")) {
      riskScore += 15;
      warnings.push(`Large BNB transfer: ${ethers.formatEther(value)} BNB`);
    }

    // Transfer to exchange (might be intentional)
    if (KNOWN_EXCHANGES[toLower]) {
      warnings.push(`Sending to exchange: ${KNOWN_EXCHANGES[toLower]}`);
    }

    return { riskScore: Math.min(100, riskScore), warnings };
  }
}
