// src/lib/engine/runner-daemon.ts
// Standalone backend strategy runner — executes all "running" strategies on a 30s interval.
// Run with: npm run runner

// Load .env.local for API keys
import { readFileSync } from "fs";
import { resolve } from "path";
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

import { initializeDatabase } from "@/lib/db/schema";
import { getAllStrategies } from "@/lib/db/queries";
import { runStrategyTick } from "./strategy-runner";
import type { ExecutionLogEntry } from "@/types";

const TICK_INTERVAL_MS = 30_000;

// ── Pretty logging ──

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function logHeader(msg: string) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  ${msg}`);
  console.log(`${"═".repeat(70)}`);
}

function logNodeFlow(log: ExecutionLogEntry) {
  const nodeLogs = log.nodeLogs ?? {};
  const statuses = (nodeLogs._nodeStatuses ?? {}) as Record<string, string>;

  const nodeIds = Object.keys(nodeLogs).filter((k) => !k.startsWith("_"));
  if (nodeIds.length === 0) {
    console.log("    (no node outputs)");
    return;
  }

  for (const nodeId of nodeIds) {
    const entry = nodeLogs[nodeId];
    const status = statuses[nodeId] ?? entry?.status ?? "?";
    const icon = status === "passed" ? "✓" : status === "blocked" ? "✗" : "⚠";
    const shortId = nodeId.slice(0, 8);

    // Pick the most interesting output values to display
    const outputs = entry?.outputs ?? entry ?? {};
    const displayKeys = Object.keys(outputs)
      .filter((k) => !k.startsWith("_") && k !== "nodeId" && k !== "status")
      .slice(0, 4);
    const displayValues = displayKeys
      .map((k) => {
        const v = outputs[k];
        if (v === null || v === undefined) return `${k}=null`;
        if (typeof v === "number") return `${k}=${v}`;
        if (typeof v === "string") return `${k}="${v.slice(0, 40)}"`;
        if (typeof v === "boolean") return `${k}=${v}`;
        if (Array.isArray(v)) return `${k}=[${v.length} items]`;
        return `${k}={...}`;
      })
      .join(", ");

    console.log(`    [${icon}] ${shortId}  ${status.padEnd(8)}  ${displayValues || "(empty)"}`);
  }

  if (log.tradePlaced && log.tradeDetails) {
    const t = log.tradeDetails;
    const mkt = String(t.marketId ?? "").slice(0, 20);
    console.log(
      `    >>> TRADE: ${t.direction} on ${t.platform} market=${mkt}… $${t.amount} @ ${t.price}`
    );
  }
}

// ── Main tick loop ──

async function tick() {
  const strategies = getAllStrategies().filter((s) => s.status === "running");

  if (strategies.length === 0) {
    console.log(`[${timestamp()}] No running strategies. Waiting...`);
    return;
  }

  logHeader(`TICK @ ${timestamp()} — ${strategies.length} running strateg${strategies.length === 1 ? "y" : "ies"}`);

  for (const strategy of strategies) {
    const shortId = strategy.id.slice(0, 8);
    console.log(
      `\n  ▸ ${strategy.name} (${shortId}…) — ${strategy.nodes.length} nodes, ${strategy.connections.length} edges`
    );

    const start = Date.now();

    try {
      const log = await runStrategyTick(strategy.id);
      const elapsed = Date.now() - start;

      if (!log) {
        console.log(`    ⏭  Skipped (not running or missing)`);
        continue;
      }

      console.log(`    ⏱  Completed in ${elapsed}ms`);
      logNodeFlow(log);
    } catch (err) {
      console.error(`    ❌ Error: ${err}`);
    }
  }

  console.log(`\n${"─".repeat(70)}`);
  console.log(`  Next tick in ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`${"─".repeat(70)}`);
}

// ── Bootstrap ──

async function main() {
  console.log(`\n🚀 Edge Strategy Runner Daemon`);
  console.log(`   Tick interval: ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`   DB: oracle.db (cwd: ${process.cwd()})`);

  initializeDatabase();

  // Check for strategies
  const all = getAllStrategies();
  const running = all.filter((s) => s.status === "running");
  console.log(`   Strategies: ${all.length} total, ${running.length} running\n`);

  if (running.length === 0 && all.length > 0) {
    console.log(`   ⚠  No strategies are in "running" state.`);
    console.log(`      Set a strategy to "running" via the UI or API, then restart.\n`);
    console.log(`   Available strategies:`);
    for (const s of all) {
      console.log(`     - ${s.name} (${s.id.slice(0, 8)}…) [${s.status}]`);
    }
    console.log();
  }

  // Run immediately, then on interval
  await tick();
  setInterval(tick, TICK_INTERVAL_MS);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
