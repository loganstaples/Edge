// test-pipeline.ts
// Standalone test: Gemini Markets Feed → AI Analyst → Edge Calculator → Trade
// Run with: npx tsx -r tsconfig-paths/register src/lib/engine/test-pipeline.ts

import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

import type { Strategy, StrategyNode, StrategyConnection } from "@/types";
import { executeStrategy } from "./executor";

// ── Build a minimal 4-node strategy ──

const nodes: StrategyNode[] = [
  {
    id: "gemini-feed",
    type: "gemini_markets_feed",
    category: "data",
    position: { x: 0, y: 0 },
    config: {
      watch_mode: "category",
      category: "all",
      max_results: 2,       // Just 2 events to keep it quick
      max_items: 2,
      alert_threshold: 5,
    },
  },
  {
    id: "analyst",
    type: "ai_analyst",
    category: "ai",
    position: { x: 300, y: 0 },
    config: {
      instruction:
        "Analyze this prediction market event. Think independently — do NOT just echo the market price as your probability. Consider what information the market might be missing, overweighting, or underweighting. Return your honest probability estimate even if it differs significantly from the current market price.",
      structured: true,
      depth: "fast",         // Use Haiku fast for speed
    },
  },
  {
    id: "edge-calc",
    type: "edge_calculator",
    category: "logic",       // MUST be logic so it routes to the real edge calculator
    position: { x: 600, y: 0 },
    config: {
      min_edge: 1,           // 1% minimum edge — low bar to test trade flow
      sizing_mode: "fixed",
      fixed_size: 25,
      decay_halflife: "60",
    },
  },
  {
    id: "trade",
    type: "trade_advanced",
    category: "action",
    position: { x: 900, y: 0 },
    config: {
      mode: "simulate",
      platform: "gemini",
      direction: "auto",
      order_type: "market",
      max_position: 100,
    },
  },
];

const connections: StrategyConnection[] = [
  { id: "e1", source_id: "gemini-feed", source_handle: "output", target_id: "analyst", target_handle: "input" },
  { id: "e2", source_id: "analyst", source_handle: "output", target_id: "edge-calc", target_handle: "input" },
  { id: "e3", source_id: "edge-calc", source_handle: "output", target_id: "trade", target_handle: "input" },
];

const strategy: Strategy = {
  id: "test-pipeline",
  name: "Test Pipeline",
  description: "Gemini Feed → AI Analyst → Edge Calculator → Trade",
  authorName: "test",
  nodes,
  connections,
  status: "running",
  isPublic: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ── Run it ──

async function main() {
  console.log("\n" + "=".repeat(70));
  console.log("  TEST PIPELINE: Gemini Feed → AI Analyst → Edge Calc → Trade");
  console.log("=".repeat(70));
  console.log(`  Nodes: ${nodes.map((n) => n.type).join(" → ")}`);
  console.log(`  Time:  ${new Date().toISOString()}\n`);

  const start = Date.now();

  try {
    const result = await executeStrategy(strategy);
    const elapsed = Date.now() - start;

    console.log("\n" + "-".repeat(70));
    console.log(`  RESULTS (${elapsed}ms)`);
    console.log("-".repeat(70));

    // Log each node output
    for (const nodeOut of result.nodeOutputs) {
      const node = nodes.find((n) => n.id === nodeOut.nodeId);
      const icon = nodeOut.status === "passed" ? "PASS" : nodeOut.status === "blocked" ? "BLOCK" : "WARN";
      console.log(`\n  [${icon}] ${nodeOut.nodeId} (${node?.type})`);

      if (nodeOut.error) {
        console.log(`    ERROR: ${nodeOut.error}`);
      }

      const outputs = nodeOut.outputs;
      for (const [key, value] of Object.entries(outputs)) {
        if (key.startsWith("_")) continue;
        const display =
          typeof value === "string" && value.length > 80
            ? value.slice(0, 80) + "..."
            : typeof value === "object"
            ? JSON.stringify(value).slice(0, 100)
            : value;
        console.log(`    ${key}: ${display}`);
      }

      // Print gate details if present
      if (outputs._gate_result !== undefined) {
        console.log(`    _gate_result: ${outputs._gate_result}`);
        console.log(`    _gate_details: ${outputs._gate_details}`);
      }
    }

    // Trades summary
    console.log("\n" + "-".repeat(70));
    if (result.tradesPlaced.length > 0) {
      console.log("  TRADES PLACED:");
      for (const t of result.tradesPlaced) {
        console.log(`    ${t.direction} on ${t.platform} | market: ${String(t.marketId).slice(0, 30)}… | $${t.amount} @ ${t.price}`);
      }
    } else {
      console.log("  NO TRADES (edge below threshold or gate blocked)");
    }

    console.log("\n" + "=".repeat(70));
    console.log(`  Pipeline complete. ${result.nodeOutputs.length} node outputs, ${result.tradesPlaced.length} trades.`);
    console.log("=".repeat(70) + "\n");
  } catch (err) {
    console.error("\nPIPELINE ERROR:", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
