// src/app/api/strategies/[id]/backtest/route.ts
import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getStrategy } from "@/lib/db/queries";
import { runBacktest } from "@/lib/engine/backtester";

let initialized = false;
function ensureInit() {
  if (!initialized) { initializeDatabase(); initialized = true; }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  ensureInit();
  const { id } = params;

  const strategy = getStrategy(id);
  if (!strategy) {
    return NextResponse.json({ error: "Strategy not found" }, { status: 404 });
  }

  let body: {
    nodes?: any[];
    connections?: any[];
    ticks?: number;
    startingCapital?: number;
    period?: "1d" | "1w" | "2w" | "1m";
    speed?: "slow" | "normal" | "fast";
  } = {};
  try {
    body = await req.json();
  } catch {
    // Use defaults
  }

  // Use nodes from request body (client-decrypted), fall back to DB (legacy/migration)
  const strategyWithNodes = {
    ...strategy,
    nodes: body.nodes && body.nodes.length > 0 ? body.nodes : strategy.nodes,
    connections: body.connections && body.connections.length > 0 ? body.connections : strategy.connections,
  };

  if (strategyWithNodes.nodes.length === 0) {
    return NextResponse.json(
      { error: "No strategy nodes provided. Decrypt your strategy and include nodes in the request." },
      { status: 400 },
    );
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const write = (event: Record<string, unknown>) => {
    writer.write(encoder.encode(JSON.stringify(event) + "\n"));
  };

  // Per-node yield: just enough for the client to render the highlight.
  // Real processing time adds on top naturally (AI calls, etc.).
  const nodeDelay = body.speed === "slow" ? 200 : body.speed === "fast" ? 0 : 80;

  (async () => {
    try {
      await runBacktest(
        strategyWithNodes,
        {
          ticks: body.ticks ?? 60,
          startingCapital: body.startingCapital ?? 1000,
          period: body.period ?? "1w",
        },
        async (event) => {
          write(event);
          // Yield after node_start so the client can render before the next event.
          // No delay on tick events — no dead time at the end.
          if (event.type === "node_start" && nodeDelay > 0) {
            await new Promise((r) => setTimeout(r, nodeDelay));
          }
        },
      );
    } catch (error) {
      write({ type: "error", error: `Backtest failed: ${String(error)}` });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
