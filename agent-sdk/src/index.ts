/**
 * @aegis-protocol/agent-sdk
 *
 * Standard interfaces and utilities for building custom Aegis Protocol
 * scanner agents on BNB Chain. Agents scan tokens, analyze risk, and
 * submit attestations to the on-chain consensus protocol.
 *
 * Quick start:
 * ```ts
 * import { AegisAgent, GoPlusAdapter } from "@aegis-protocol/agent-sdk";
 *
 * const agent = new AegisAgent({
 *   rpcUrl: "https://data-seed-prebsc-1-s1.binance.org:8545",
 *   privateKey: process.env.AGENT_KEY!,
 *   consensusAddress: "0x...",
 *   stakingAddress: "0x...",
 * });
 *
 * agent.addScanner(new GoPlusAdapter());
 * await agent.scanAndAttest("0xTokenAddress");
 * ```
 */

export { AegisAgent } from "./agent";
export { GoPlusAdapter } from "./adapters/goplus";
export type { IScanner, IAnalyzer, ISubmitter } from "./interfaces";
export type { ScanResult, TokenAnalysis, AgentConfig, AttestationData, AgentStats } from "./types";
export { CONSENSUS_ABI, STAKING_ABI, SCANNER_ABI } from "./abi";
