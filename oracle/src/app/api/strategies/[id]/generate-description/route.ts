import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy, updateStrategy } from "@/lib/db/queries";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

const client = new Anthropic();

const SYSTEM_PROMPT = `You write public descriptions for trading strategy NFTs on a prediction market platform called EDGE.

Given the strategy's name and its node graph (the types of nodes, how they connect, and their configurations), write a 2-4 sentence description that:

1. HONESTLY describes what the strategy does at a conceptual level — what data it watches, what analysis it performs, and what actions it takes
2. Is CLEAR enough that a buyer on a marketplace can make an informed decision about whether this strategy fits their needs
3. Does NOT reveal proprietary details — omit specific thresholds, exact parameter values, model configurations, and precise formulas. Say "monitors news for specific sectors" not "monitors news with keywords 'AI, OpenAI, GPT'"
4. Uses plain language a non-technical person could understand
5. Is honest about risk — if the strategy is aggressive, say so. If it's conservative, say that.

Examples of good descriptions:
- "Monitors breaking news in the technology sector and uses AI analysis to identify prediction markets that could be affected. When it finds a meaningful edge between its estimated probability and the market price, it places trades with a cooldown to avoid overtrading."
- "Watches cryptocurrency price movements and social media sentiment simultaneously. Only acts when both signals agree, using a consensus mechanism to filter out noise before placing conservative trades on Polymarket."
- "A high-frequency arbitrage strategy that compares prices across Polymarket and Gemini for the same events, trading when it detects pricing discrepancies above a configured threshold."

Respond with ONLY the description text. No quotes, no prefix, no explanation.`;

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;
  const walletAddress = req.headers.get("x-wallet-address");

  const strategy = getStrategy(id);
  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  if (strategy.ownerWallet && strategy.ownerWallet !== walletAddress) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await req.json();
  const { nodes, connections } = body;

  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return NextResponse.json({ error: "nodes required" }, { status: 400 });
  }

  // Build a sanitized view of the node graph for the LLM
  const nodeDescriptions = nodes.map((n: any) => {
    // Include type and category but redact specific config values
    const safeConfig: Record<string, any> = {};
    if (n.config) {
      for (const [key, value] of Object.entries(n.config)) {
        // Keep structural config (mode, type selectors) but redact specific values
        if (["mode", "watch_mode", "category", "depth", "model", "consensus_mode", "aggregation", "domain", "chain", "platform", "timeframe", "token"].includes(key)) {
          safeConfig[key] = value;
        } else if (typeof value === "boolean") {
          safeConfig[key] = value;
        } else {
          safeConfig[key] = "[configured]";
        }
      }
    }
    return {
      id: n.id,
      type: n.type,
      category: n.category,
      config: safeConfig,
    };
  });

  const connectionDescriptions = (connections || []).map((c: any) => ({
    from: c.source_id,
    to: c.target_id,
  }));

  const userMessage = `Strategy name: "${strategy.name}"

Node graph:
${JSON.stringify(nodeDescriptions, null, 2)}

Connections:
${JSON.stringify(connectionDescriptions, null, 2)}`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const description = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    // Store the generated description
    updateStrategy(id, { description });

    return NextResponse.json({ description });
  } catch (error) {
    return NextResponse.json(
      { error: `Description generation failed: ${String(error)}` },
      { status: 500 },
    );
  }
}
