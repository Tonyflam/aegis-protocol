// ═══════════════════════════════════════════════════════════════
// Aegis Protocol — AI Agent API Route
// Proxies LLM calls to Groq so API keys stay server-side.
// POST { messages, agentType }
// ═══════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.AI_MODEL || "llama-3.3-70b-versatile";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY || "";
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI engine not configured — set GROQ_API_KEY" },
      { status: 503 },
    );
  }

  let body: { messages: { role: string; content: string }[]; agentType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  // Validate message structure
  for (const msg of body.messages) {
    if (!msg.role || !msg.content || typeof msg.content !== "string") {
      return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
    }
    if (!["system", "user", "assistant"].includes(msg.role)) {
      return NextResponse.json({ error: `Invalid role: ${msg.role}` }, { status: 400 });
    }
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: body.messages,
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      console.error(`[Aegis AI API] Groq ${groqRes.status}: ${errText.slice(0, 200)}`);
      return NextResponse.json(
        { error: "AI engine error", status: groqRes.status },
        { status: 502 },
      );
    }

    const groqJson = await groqRes.json();
    const content = groqJson.choices?.[0]?.message?.content || "";
    const tokens = groqJson.usage?.total_tokens || 0;

    return NextResponse.json({ content, tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[Aegis AI API] Error: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
