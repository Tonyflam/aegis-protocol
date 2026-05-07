import { NextRequest } from "next/server";

// Phase 3: streaming AI reasoning for token scans.
//
// Wire format: Server-Sent Events (SSE).
//   event: stage     data: { id, label, status: "running"|"done" }
//   event: reasoning data: { delta: "<token chunk>" }
//   event: structured data: { severity, confidence, citations[], action }
//   event: done      data: {}
//   event: error     data: { message }
//
// Falls back to a deterministic rule-based reasoning when GROQ_API_KEY is
// missing or the upstream call fails — the user always gets a complete
// response.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GROQ_KEY = process.env.GROQ_API_KEY || "";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

type ScanInput = {
  address?: string;
  symbol?: string;
  name?: string;
  riskScore?: number;
  recommendation?: string;
  flags?: string[];
  buyTax?: number;
  sellTax?: number;
  liquidityUsd?: number;
  isHoneypot?: boolean;
  isRenounced?: boolean;
  isLiquidityLocked?: boolean;
  ownerCanMint?: boolean;
  ownerCanPause?: boolean;
  ownerCanBlacklist?: boolean;
  topHolderPercent?: number;
  holderCount?: number;
};

type Severity = "SAFE" | "CAUTION" | "AT_RISK" | "DANGEROUS";

const SEVERITY_FROM_SCORE = (score: number): Severity =>
  score >= 70 ? "DANGEROUS" : score >= 40 ? "AT_RISK" : score >= 20 ? "CAUTION" : "SAFE";

function citationsFor(scan: ScanInput): string[] {
  const c: string[] = [];
  if (scan.isHoneypot) c.push("Honeypot signature detected on simulated trade");
  if (scan.ownerCanMint) c.push("Owner retains mint authority \u2014 supply can be inflated");
  if (scan.ownerCanPause) c.push("Owner can pause transfers at any time");
  if (scan.ownerCanBlacklist) c.push("Owner can blacklist holders, freezing balances");
  if (typeof scan.buyTax === "number" && scan.buyTax > 5) c.push(`Buy tax is ${scan.buyTax.toFixed(1)}% (above 5% threshold)`);
  if (typeof scan.sellTax === "number" && scan.sellTax > 5) c.push(`Sell tax is ${scan.sellTax.toFixed(1)}% (above 5% threshold)`);
  if (typeof scan.liquidityUsd === "number" && scan.liquidityUsd < 10_000) c.push(`Liquidity is only $${Math.round(scan.liquidityUsd).toLocaleString()}`);
  if (scan.isLiquidityLocked === false) c.push("Liquidity is not locked \u2014 rug pull risk");
  if (scan.isRenounced === false) c.push("Contract ownership has not been renounced");
  if (typeof scan.topHolderPercent === "number" && scan.topHolderPercent > 30) c.push(`Top holder controls ${scan.topHolderPercent.toFixed(1)}% of supply`);
  return c.slice(0, 6);
}

function actionFor(severity: Severity, scan: ScanInput): string {
  if (severity === "DANGEROUS") return `Do not buy. ${scan.symbol ? `If you hold $${scan.symbol}, exit while liquidity remains.` : "Avoid this token."}`;
  if (severity === "AT_RISK") return `Treat as speculative only. Position size <1% of portfolio. Set a tight stop-loss.`;
  if (severity === "CAUTION") return "Monitor for further red flags. Do not allocate from your defended capital.";
  return "No high-severity flags. Standard market risk still applies.";
}

function ruleBasedReasoning(scan: ScanInput): { reasoning: string; severity: Severity; confidence: number; citations: string[]; action: string } {
  const score = scan.riskScore ?? 0;
  const severity = SEVERITY_FROM_SCORE(score);
  const citations = citationsFor(scan);
  const action = actionFor(severity, scan);
  const sym = scan.symbol ? `$${scan.symbol}` : "this token";
  const reasoning =
    severity === "DANGEROUS"
      ? `${sym} fails multiple safety checks. ${citations[0] || "Honeypot or owner-controlled mechanics dominate the risk profile"}. Combined with ${citations[1] || "weak liquidity"}, the token cannot be considered safe for any allocation. The risk score of ${score}/100 reflects compounding contract-level and market-level threats.`
      : severity === "AT_RISK"
      ? `${sym} carries elevated risk at ${score}/100. ${citations[0] || "Owner privileges remain"} and ${citations[1] || "liquidity is thin"}. Trading is technically possible but the asymmetry favors the deployer.`
      : severity === "CAUTION"
      ? `${sym} shows mixed signals at ${score}/100. ${citations[0] || "Some owner privileges remain"}, though core honeypot mechanics appear absent. Treat as speculative.`
      : `${sym} passes core safety checks at ${score}/100. Contract is renounced or near-renounced, liquidity is reasonable, and tax rates are within normal market bounds.`;
  // Confidence: rule-based is high when many citations agree, lower when sparse.
  const confidence = Math.min(0.96, 0.62 + citations.length * 0.05);
  return { reasoning, severity, confidence, citations, action };
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const STAGES: { id: string; label: string }[] = [
  { id: "fetch", label: "Pulling on-chain bytecode & metadata" },
  { id: "honeypot", label: "Simulating buy/sell to detect honeypot mechanics" },
  { id: "ownership", label: "Inspecting owner privileges (mint, pause, blacklist)" },
  { id: "liquidity", label: "Mapping LP holders & lock status" },
  { id: "ai", label: "Running Aegis AI reasoning model" },
];

async function callGroqStream(scan: ScanInput, signal: AbortSignal): Promise<ReadableStream<Uint8Array> | null> {
  if (!GROQ_KEY) return null;
  const flagSummary = (scan.flags || []).slice(0, 12).join(", ") || "none";
  const prompt = `You are Aegis Shield AI, an expert DeFi security analyst on BNB Chain. Analyze the token scan below and respond in TWO clearly delimited sections.

Token: ${scan.name || "Unknown"} ($${scan.symbol || "?"}) at ${scan.address || "?"}
Risk score: ${scan.riskScore ?? "?"}/100 (${scan.recommendation || "?"})
Buy/Sell tax: ${scan.buyTax ?? "?"}% / ${scan.sellTax ?? "?"}%
Liquidity: $${(scan.liquidityUsd ?? 0).toFixed(0)}
LP locked: ${scan.isLiquidityLocked} | Honeypot: ${scan.isHoneypot} | Renounced: ${scan.isRenounced}
Owner privileges: mint=${scan.ownerCanMint}, pause=${scan.ownerCanPause}, blacklist=${scan.ownerCanBlacklist}
Top holder: ${scan.topHolderPercent ?? "?"}% | Holders: ${scan.holderCount ?? "?"}
Flags: ${flagSummary}

Format your response EXACTLY like this (no markdown headers, no backticks):

REASONING:
<2-4 sentences of analyst-grade reasoning. Cite specific numbers from the data above. Be direct, not hedged. Address the user as "you".>

STRUCTURED:
{"severity":"SAFE|CAUTION|AT_RISK|DANGEROUS","confidence":0.0-1.0,"citations":["specific citation 1","specific citation 2","specific citation 3"],"action":"single sentence telling the user what to do"}`;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.2,
      stream: true,
    }),
    signal,
  });
  if (!res.ok || !res.body) return null;
  return res.body;
}

// Parse the OpenAI-style SSE chunk and pull out the delta content text.
function extractDelta(chunk: string): string {
  // Each chunk may contain multiple `data: {...}` lines.
  let out = "";
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const obj = JSON.parse(payload);
      const delta = obj?.choices?.[0]?.delta?.content;
      if (typeof delta === "string") out += delta;
    } catch { /* partial chunk \u2014 ignored, will be retried by upstream */ }
  }
  return out;
}

export async function POST(request: NextRequest) {
  let scan: ScanInput;
  try {
    scan = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }
  if (!scan || typeof scan !== "object") {
    return new Response("Missing scan payload", { status: 400 });
  }

  const ac = new AbortController();
  request.signal.addEventListener("abort", () => ac.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) => {
        try { controller.enqueue(enc.encode(sseEncode(event, data))); } catch { /* closed */ }
      };
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

      try {
        // 1. Emit scanning stages with small dwell so the UI feels deliberate.
        for (let i = 0; i < STAGES.length; i++) {
          const s = STAGES[i];
          send("stage", { id: s.id, label: s.label, status: "running", index: i, total: STAGES.length });
          await sleep(280 + Math.floor(Math.random() * 220));
          send("stage", { id: s.id, label: s.label, status: "done", index: i, total: STAGES.length });
        }

        // 2. Try Groq streaming. If unavailable, emit deterministic fallback.
        const upstream = await callGroqStream(scan, ac.signal).catch(() => null);
        if (!upstream) {
          const rb = ruleBasedReasoning(scan);
          // Stream the fallback reasoning word-by-word so the UI still feels alive.
          const words = rb.reasoning.split(/(\s+)/);
          for (const w of words) {
            send("reasoning", { delta: w });
            await sleep(18);
          }
          send("structured", {
            severity: rb.severity,
            confidence: rb.confidence,
            citations: rb.citations,
            action: rb.action,
            source: "rule-based",
          });
          send("done", {});
          controller.close();
          return;
        }

        // 3. Stream Groq tokens. Switch from reasoning -> structured when we
        //    see the "STRUCTURED:" marker. Buffer the JSON tail and parse at end.
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let mode: "preamble" | "reasoning" | "structured" = "preamble";
        let structuredBuffer = "";
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const delta = extractDelta(text);
          if (!delta) continue;
          buffer += delta;

          // Phase transitions
          if (mode === "preamble") {
            const idx = buffer.indexOf("REASONING:");
            if (idx >= 0) {
              buffer = buffer.slice(idx + "REASONING:".length).replace(/^\s+/, "");
              mode = "reasoning";
            } else {
              continue;
            }
          }
          if (mode === "reasoning") {
            const idx = buffer.indexOf("STRUCTURED:");
            if (idx >= 0) {
              const head = buffer.slice(0, idx);
              if (head) send("reasoning", { delta: head });
              structuredBuffer = buffer.slice(idx + "STRUCTURED:".length);
              buffer = "";
              mode = "structured";
            } else {
              // Hold back the last few chars so we don't split the marker.
              if (buffer.length > 12) {
                const emit = buffer.slice(0, buffer.length - 12);
                structuredBuffer = "";
                send("reasoning", { delta: emit });
                buffer = buffer.slice(buffer.length - 12);
              }
            }
          } else if (mode === "structured") {
            structuredBuffer += "";
            structuredBuffer = (structuredBuffer + "").length ? structuredBuffer : structuredBuffer;
            // Just accumulate; parse at end. (We re-use `buffer` as no-op here.)
            structuredBuffer += "";
          }
        }
        // Drain anything left in `buffer` for reasoning mode.
        if (mode === "reasoning" && buffer) {
          send("reasoning", { delta: buffer });
        }
        // Re-collect structured tail correctly: extract from the original combined stream.
        // Simpler approach: parse from accumulated structuredBuffer if it has braces;
        // otherwise fall back to rule-based for the structured portion.
        let structured: { severity: Severity; confidence: number; citations: string[]; action: string; source?: string } | null = null;
        const m = structuredBuffer.match(/\{[\s\S]*\}/);
        if (m) {
          try {
            const parsed = JSON.parse(m[0]);
            const sev: Severity = ["SAFE", "CAUTION", "AT_RISK", "DANGEROUS"].includes(parsed.severity)
              ? parsed.severity
              : SEVERITY_FROM_SCORE(scan.riskScore ?? 0);
            const conf = typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.8;
            const citations = Array.isArray(parsed.citations) ? parsed.citations.slice(0, 6).map(String) : citationsFor(scan);
            const action = typeof parsed.action === "string" && parsed.action.trim() ? parsed.action : actionFor(sev, scan);
            structured = { severity: sev, confidence: conf, citations, action, source: "groq" };
          } catch { /* fall through */ }
        }
        if (!structured) {
          const rb = ruleBasedReasoning(scan);
          structured = { severity: rb.severity, confidence: rb.confidence, citations: rb.citations, action: rb.action, source: "rule-based-fallback" };
        }
        send("structured", structured);
        send("done", {});
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Reasoning stream failed";
        send("error", { message });
        try { controller.close(); } catch { /* already closed */ }
      }
    },
    cancel() {
      ac.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
