// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Scan Priority Queue
// Prioritized queue: new pairs first, then periodic re-scans.
// High-risk tokens re-scan every 1h, medium 6h, low 24h.
// ═══════════════════════════════════════════════════════════════

export enum ScanPriority {
  NEW_PAIR = 0,     // Highest — just created
  HIGH_RISK = 1,    // Re-scan every 1 hour
  MEDIUM_RISK = 2,  // Re-scan every 6 hours
  LOW_RISK = 3,     // Re-scan every 24 hours
}

export interface ScanJob {
  token: string;
  priority: ScanPriority;
  addedAt: number;        // ms timestamp when enqueued
  lastScanned: number;    // ms timestamp of last completed scan (0 = never)
  riskScore: number;      // last known score (0 = unknown)
  attempts: number;       // consecutive failure count
}

// Re-scan intervals in milliseconds
const RESCAN_INTERVALS: Record<ScanPriority, number> = {
  [ScanPriority.NEW_PAIR]: 0,                // immediate
  [ScanPriority.HIGH_RISK]: 1 * 60 * 60_000, // 1 hour
  [ScanPriority.MEDIUM_RISK]: 6 * 60 * 60_000, // 6 hours
  [ScanPriority.LOW_RISK]: 24 * 60 * 60_000, // 24 hours
};

const MAX_ATTEMPTS = 3;
const MAX_QUEUE_SIZE = 5000;

export class ScanQueue {
  private queue: Map<string, ScanJob> = new Map();     // token → job
  private processing: Set<string> = new Set();          // tokens currently being scanned

  get size(): number {
    return this.queue.size;
  }

  get pendingCount(): number {
    return this.queue.size - this.processing.size;
  }

  /** Enqueue a brand-new pair for immediate scan */
  enqueueNewPair(token: string): boolean {
    const addr = token.toLowerCase();
    if (this.queue.size >= MAX_QUEUE_SIZE) return false;

    // New pair always takes priority even if already queued
    this.queue.set(addr, {
      token: addr,
      priority: ScanPriority.NEW_PAIR,
      addedAt: Date.now(),
      lastScanned: 0,
      riskScore: 0,
      attempts: 0,
    });
    return true;
  }

  /** Enqueue a token for periodic re-scan based on its risk score */
  enqueueRescan(token: string, riskScore: number): void {
    const addr = token.toLowerCase();
    const priority = riskScoreToPriority(riskScore);

    const existing = this.queue.get(addr);
    // Don't overwrite a higher-priority pending job
    if (existing && existing.priority <= priority && existing.lastScanned === 0) return;

    this.queue.set(addr, {
      token: addr,
      priority,
      addedAt: Date.now(),
      lastScanned: existing?.lastScanned ?? Date.now(),
      riskScore,
      attempts: 0,
    });
  }

  /**
   * Get the next token to scan.
   * Returns null if nothing is ready.
   * Picks by: (1) priority ASC, (2) addedAt ASC (oldest first)
   * Skips tokens not yet due for re-scan.
   */
  dequeue(): ScanJob | null {
    const now = Date.now();
    let best: ScanJob | null = null;

    for (const job of this.queue.values()) {
      // Skip if already being processed
      if (this.processing.has(job.token)) continue;
      // Skip if too many failures
      if (job.attempts >= MAX_ATTEMPTS) continue;
      // Skip if not yet due for re-scan
      if (job.lastScanned > 0) {
        const interval = RESCAN_INTERVALS[job.priority];
        if (now - job.lastScanned < interval) continue;
      }
      // Pick highest priority (lowest enum), then oldest
      if (!best || job.priority < best.priority || (job.priority === best.priority && job.addedAt < best.addedAt)) {
        best = job;
      }
    }

    if (best) {
      this.processing.add(best.token);
    }
    return best;
  }

  /** Mark a scan as completed. Updates score + schedules re-scan. */
  complete(token: string, riskScore: number): void {
    const addr = token.toLowerCase();
    this.processing.delete(addr);

    const priority = riskScoreToPriority(riskScore);
    this.queue.set(addr, {
      token: addr,
      priority,
      addedAt: Date.now(),
      lastScanned: Date.now(),
      riskScore,
      attempts: 0,
    });
  }

  /** Mark a scan as failed. Increments attempt counter. */
  fail(token: string): void {
    const addr = token.toLowerCase();
    this.processing.delete(addr);

    const job = this.queue.get(addr);
    if (job) {
      job.attempts++;
      // After MAX_ATTEMPTS, remove from queue
      if (job.attempts >= MAX_ATTEMPTS) {
        this.queue.delete(addr);
      }
    }
  }

  /** Remove a token from the queue entirely */
  remove(token: string): void {
    const addr = token.toLowerCase();
    this.queue.delete(addr);
    this.processing.delete(addr);
  }

  /** Get stats for logging */
  getStats(): { total: number; processing: number; newPairs: number; highRisk: number; mediumRisk: number; lowRisk: number } {
    let newPairs = 0, highRisk = 0, mediumRisk = 0, lowRisk = 0;
    for (const job of this.queue.values()) {
      switch (job.priority) {
        case ScanPriority.NEW_PAIR: newPairs++; break;
        case ScanPriority.HIGH_RISK: highRisk++; break;
        case ScanPriority.MEDIUM_RISK: mediumRisk++; break;
        case ScanPriority.LOW_RISK: lowRisk++; break;
      }
    }
    return { total: this.queue.size, processing: this.processing.size, newPairs, highRisk, mediumRisk, lowRisk };
  }
}

function riskScoreToPriority(score: number): ScanPriority {
  if (score >= 70) return ScanPriority.HIGH_RISK;
  if (score >= 40) return ScanPriority.MEDIUM_RISK;
  return ScanPriority.LOW_RISK;
}
