import type { ScanResult, TokenAnalysis, AttestationData } from "./types";

/**
 * IScanner — Scans a token and produces raw risk data.
 * Implement this to add a new data source (e.g., custom heuristic scanner).
 */
export interface IScanner {
  name: string;
  scan(tokenAddress: string): Promise<ScanResult>;
}

/**
 * IAnalyzer — Takes raw scans from multiple sources and produces a merged analysis.
 * Implement this to add cross-referencing, AI analysis, or custom scoring logic.
 */
export interface IAnalyzer {
  name: string;
  analyze(tokenAddress: string, scans: ScanResult[]): Promise<TokenAnalysis>;
}

/**
 * ISubmitter — Submits the final attestation on-chain.
 * The default implementation submits to AegisConsensus.submitAttestation().
 * Implement this to customize submission behavior (batching, retries, etc.).
 */
export interface ISubmitter {
  submit(attestation: AttestationData): Promise<string>; // returns tx hash
}
