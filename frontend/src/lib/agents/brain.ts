// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — Autonomous Agent Brain
// The core reasoning loop: Observe → Think → Decide → Act
// Each agent uses this brain with different tools and prompts.
// ═══════════════════════════════════════════════════════════════

export interface ThoughtEntry {
  id: string;
  timestamp: number;
  phase: "OBSERVE" | "THINK" | "DECIDE" | "ACT" | "ERROR" | "IDLE";
  content: string;
  data?: Record<string, unknown>;
}

export interface PendingAction {
  id: string;
  timestamp: number;
  type: string;
  description: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  params: Record<string, unknown>;
  reasoning: string;
  status: "pending" | "approved" | "executing" | "completed" | "rejected" | "failed";
  txHash?: string;
  error?: string;
}

export interface AgentState {
  status: "idle" | "thinking" | "observing" | "deciding" | "acting" | "paused" | "error";
  thoughts: ThoughtEntry[];
  pendingActions: PendingAction[];
  cycleCount: number;
  lastCycle: number | null;
  observations: Record<string, unknown>;
  isRunning: boolean;
}

// ─── LLM Call (Proxied) ──────────────────────────────────────

export async function callAgentLLM(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch("/api/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Network error" }));
    throw new Error(err.error || `API ${res.status}`);
  }

  const json = await res.json();
  return json.content || "";
}

// ─── Utilities ───────────────────────────────────────────────

let idCounter = 0;
export function makeId(): string {
  return `${Date.now()}-${++idCounter}`;
}

export function createThought(
  phase: ThoughtEntry["phase"],
  content: string,
  data?: Record<string, unknown>,
): ThoughtEntry {
  return { id: makeId(), timestamp: Date.now(), phase, content, data };
}

export function createAction(
  type: string,
  description: string,
  risk: PendingAction["risk"],
  params: Record<string, unknown>,
  reasoning: string,
): PendingAction {
  return {
    id: makeId(),
    timestamp: Date.now(),
    type,
    description,
    risk,
    params,
    reasoning,
    status: "pending",
  };
}
