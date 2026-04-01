// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — useAgentLoop Hook
// React hook that runs an autonomous observe→think→decide→act
// loop for any agent. Provides live thought stream and
// pending actions that require user approval for execution.
// ═══════════════════════════════════════════════════════════════

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  AgentState,
  ThoughtEntry,
  PendingAction,
  createThought,
  callAgentLLM,
} from "./brain";

const MAX_THOUGHTS = 200;

export interface AgentTool<TObservation> {
  /** Human-readable agent name */
  name: string;

  /** System prompt that defines the agent's personality+role */
  systemPrompt: string;

  /** Interval between autonomous cycles (ms). Default 45s */
  interval?: number;

  /** Gather observations from the blockchain / APIs */
  observe: (address: string | null) => Promise<TObservation>;

  /** Build the user prompt for the LLM from observations */
  buildPrompt: (obs: TObservation, history: ThoughtEntry[]) => string;

  /** Parse LLM response into actions. Return empty array if no actions needed */
  parseActions: (llmResponse: string, obs: TObservation) => PendingAction[];

  /** Execute a single approved action on-chain */
  execute: (
    action: PendingAction,
    signer: unknown,
  ) => Promise<{ txHash?: string; error?: string }>;
}

export interface UseAgentLoop<TObservation> {
  state: AgentState;
  observations: TObservation | null;
  start: () => void;
  stop: () => void;
  runOnce: () => Promise<void>;
  approveAction: (actionId: string) => Promise<void>;
  rejectAction: (actionId: string) => void;
  clearThoughts: () => void;
}

export function useAgentLoop<TObservation>(
  tool: AgentTool<TObservation>,
  walletAddress: string | null,
  signer: unknown,
): UseAgentLoop<TObservation> {
  const [state, setState] = useState<AgentState>({
    status: "idle",
    thoughts: [],
    pendingActions: [],
    cycleCount: 0,
    lastCycle: null,
    observations: {},
    isRunning: false,
  });
  const [observations, setObservations] = useState<TObservation | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);

  // ─── Add Thought ──────────────────────────────────────────

  const addThought = useCallback((t: ThoughtEntry) => {
    setState((prev) => ({
      ...prev,
      thoughts: [...prev.thoughts.slice(-MAX_THOUGHTS + 1), t],
    }));
  }, []);

  // ─── One Autonomous Cycle ─────────────────────────────────

  const runOnce = useCallback(async () => {
    if (!runningRef.current && !state.isRunning) {
      // Allow manual single runs even when stopped
    }

    // ── OBSERVE ───────────────────────────────────────────
    setState((p) => ({ ...p, status: "observing" }));
    addThought(createThought("OBSERVE", `Scanning BSC chain data${walletAddress ? ` for ${walletAddress.slice(0, 8)}...` : ""}...`));

    let obs: TObservation;
    try {
      obs = await tool.observe(walletAddress);
      setObservations(obs);
      setState((p) => ({ ...p, observations: obs as unknown as Record<string, unknown> }));
      addThought(createThought("OBSERVE", "Data collection complete.", { summary: typeof obs === "object" ? Object.keys(obs as Record<string, unknown>).length + " fields" : "done" }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      addThought(createThought("ERROR", `Observation failed: ${msg}`));
      setState((p) => ({ ...p, status: "error" }));
      return;
    }

    // ── THINK ─────────────────────────────────────────────
    setState((p) => ({ ...p, status: "thinking" }));
    addThought(createThought("THINK", "Reasoning with AI about observations..."));

    let llmResponse: string;
    try {
      const prompt = tool.buildPrompt(obs, state.thoughts.slice(-20));
      llmResponse = await callAgentLLM(tool.systemPrompt, prompt);
      addThought(createThought("THINK", `AI reasoning complete.`, { response: llmResponse.slice(0, 300) }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "LLM unavailable";
      addThought(createThought("THINK", `AI unavailable (${msg}). Using observation-only mode.`));
      llmResponse = "";
    }

    // ── DECIDE ────────────────────────────────────────────
    setState((p) => ({ ...p, status: "deciding" }));

    // Parse AI response into concrete actions
    const newActions = tool.parseActions(llmResponse, obs);

    if (newActions.length > 0) {
      for (const action of newActions) {
        addThought(
          createThought("DECIDE", `Recommending: ${action.description}`, {
            type: action.type,
            risk: action.risk,
          }),
        );
      }
      setState((p) => ({
        ...p,
        pendingActions: [
          ...p.pendingActions.filter((a) => a.status === "pending" || a.status === "executing"),
          ...newActions,
        ],
      }));
    } else {
      addThought(createThought("DECIDE", "No actions needed right now. Wallet looks healthy."));
    }

    // Log any AI summary
    if (llmResponse) {
      try {
        const parsed = JSON.parse(llmResponse);
        if (parsed.summary) {
          addThought(createThought("THINK", parsed.summary));
        }
        if (parsed.threats && parsed.threats.length > 0) {
          addThought(createThought("THINK", `Threats identified: ${parsed.threats.join(", ")}`));
        }
      } catch {
        // Not JSON — treat as raw reasoning
        if (llmResponse.length > 10 && llmResponse.length < 2000) {
          addThought(createThought("THINK", llmResponse.slice(0, 500)));
        }
      }
    }

    // ── Update cycle count ────────────────────────────────
    setState((p) => ({
      ...p,
      status: p.isRunning ? "idle" : "idle",
      cycleCount: p.cycleCount + 1,
      lastCycle: Date.now(),
    }));

    addThought(createThought("IDLE", `Cycle complete. Next scan in ${Math.round((tool.interval || 45000) / 1000)}s.`));
  }, [walletAddress, tool, state.thoughts, state.isRunning, addThought]);

  // ─── Start / Stop ─────────────────────────────────────────

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    setState((p) => ({ ...p, isRunning: true, status: "idle" }));
    addThought(createThought("IDLE", `${tool.name} agent activated. Beginning autonomous monitoring.`));

    // Run immediately, then on interval
    runOnce();
    intervalRef.current = setInterval(() => {
      runOnce();
    }, tool.interval || 45000);
  }, [tool.name, tool.interval, runOnce, addThought]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState((p) => ({ ...p, isRunning: false, status: "idle" }));
    addThought(createThought("IDLE", `${tool.name} agent paused.`));
  }, [tool.name, addThought]);

  // ─── Approve / Reject Actions ─────────────────────────────

  const approveAction = useCallback(
    async (actionId: string) => {
      setState((p) => ({
        ...p,
        pendingActions: p.pendingActions.map((a) =>
          a.id === actionId ? { ...a, status: "executing" as const } : a,
        ),
      }));

      const action = state.pendingActions.find((a) => a.id === actionId);
      if (!action) return;

      addThought(createThought("ACT", `Executing: ${action.description}...`));

      try {
        const result = await tool.execute(action, signer);
        setState((p) => ({
          ...p,
          pendingActions: p.pendingActions.map((a) =>
            a.id === actionId
              ? { ...a, status: result.error ? "failed" as const : "completed" as const, txHash: result.txHash, error: result.error }
              : a,
          ),
        }));

        if (result.error) {
          addThought(createThought("ERROR", `Action failed: ${result.error}`));
        } else {
          addThought(createThought("ACT", `Action completed.${result.txHash ? ` TX: ${result.txHash.slice(0, 16)}...` : ""}`));
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Execution failed";
        setState((p) => ({
          ...p,
          pendingActions: p.pendingActions.map((a) =>
            a.id === actionId ? { ...a, status: "failed" as const, error: msg } : a,
          ),
        }));
        addThought(createThought("ERROR", `Execution error: ${msg}`));
      }
    },
    [state.pendingActions, tool, signer, addThought],
  );

  const rejectAction = useCallback(
    (actionId: string) => {
      setState((p) => ({
        ...p,
        pendingActions: p.pendingActions.map((a) =>
          a.id === actionId ? { ...a, status: "rejected" as const } : a,
        ),
      }));
      addThought(createThought("DECIDE", "Action rejected by user."));
    },
    [addThought],
  );

  const clearThoughts = useCallback(() => {
    setState((p) => ({ ...p, thoughts: [] }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    state,
    observations,
    start,
    stop,
    runOnce,
    approveAction,
    rejectAction,
    clearThoughts,
  };
}
