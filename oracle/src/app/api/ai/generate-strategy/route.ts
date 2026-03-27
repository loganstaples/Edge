import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const STRATEGY_GENERATION_SYSTEM = `You are a trading strategy architect for the Edge platform. Given a user's natural language description of a prediction market trading strategy, generate a complete node graph.

AVAILABLE NODE TYPES:

WATCH (data sources, category "data"):
- news_monitor: Config: { keywords: string, source_tier: "top"|"all_major"|"everything", refresh: "realtime"|"30"|"60"|"300" }. Outputs: headline, source_name, source_tier, published_at, url
- polymarket_feed: Config: { market_search: string, watch_mode: "single"|"category", category: "all"|"politics"|"crypto"|"sports"|"economics"|"culture"|"world", max_results: number }. Outputs: event_title, market_id, yes_price, no_price, spread, volume_24h, liquidity
- gemini_markets_feed: Config: { event_search: string, watch_mode: "single"|"category", category: same as above, max_results: number, alert_threshold: number }. Outputs: event_title, market_id, instrument_symbol, contract_price, bid_price, ask_price, spread, liquidity, expiry_date, significant_move
- twitter_monitor: Config: { keywords: string, handles: string, min_followers: string, verified_only: boolean, exclude_retweets: boolean, language: string }. Outputs: tweet_text, author_handle, author_followers, timestamp
- crypto_price: Config: { token: "BTC"|"ETH"|"SOL"|etc, timeframe: "1m"|"5m"|"15m"|"1h"|"4h"|"24h" }. Outputs: current_price, change_pct, change_abs, volume_24h, high_24h, low_24h, token
- onchain_activity: Config: { mode: "watch_wallet"|"whale_alerts", wallet_address: string, min_value: string, chain: "all"|"ethereum"|"bitcoin"|"solana" }. Outputs: tx_hash, from_address, to_address, token, dollar_value, chain
- calendar_timer: Config: { mode: "interval"|"scheduled"|"one_shot", interval: "30"|"60"|"300"|"900"|"3600"|"14400"|"86400", scheduled_time: string, days: string[], fire_at: string }. Outputs: fired_at, fire_reason, next_fire_at
- strategy_link: Config: { strategy_id: string }. Outputs: linked_strategy_name, linked_signal, linked_edge, linked_pnl, linked_status

THINK (AI/analysis, category "ai"):
- ai_analyst: Config: { instruction: string, model: "claude"|"gpt4"|"claude-haiku", depth: "fast"|"balanced"|"thorough", structured: boolean }. Outputs: analyst_probability (0-1), analyst_confidence, analyst_direction, analyst_reasoning
- sentiment_scanner: Config: { domain: "general"|"crypto"|"political"|"financial"|"sports", aggregation: "per_item"|"5m"|"15m"|"1h" }. Outputs: scanner_sentiment_score (-100 to 100), scanner_magnitude, scanner_volume_count
- consensus: Config: { consensus_mode: "weighted_avg"|"majority", input_count: 2-5, weights: number[] }. Handles: inputs input_1 through input_5. Outputs: consensus_probability, consensus_confidence, consensus_direction, consensus_disagreement
- history_tracker: Config: { track_field: string, depth: 5|10|25|50|100, time_window: "5m"|"15m"|"1h"|"4h"|"24h"|"7d" }. Outputs: history_current, history_values, history_trend, history_avg, history_streak, history_rate_of_change
- formula: Config: { formula: string }. Outputs: formula_result, formula_error

DECIDE (logic, category "logic"):
- edge_calculator: Config: { min_edge: number (1-30), decay_halflife: "5"|"15"|"60"|"240", sizing_mode: "fixed"|"percentage"|"kelly"|"proportional", fixed_size: number, pct_size: number }. Outputs: ec_edge_pct, ec_direction, ec_suggested_size. Gates on min_edge threshold.
- arb_detector: Config: { match_mode: "auto"|"manual", min_spread: number, net_of_fees: boolean }. Handles: inputs input_1, input_2. Outputs: arb_spread_pct, arb_buy_platform, arb_sell_platform, arb_buy_price, arb_sell_price
- router: Config: { routes: [{ label: string, field: string, comparator: ">"|"<"|">="|"<="|"=="|"!="|"between", value: string, is_default?: boolean }] }. Handles: outputs route_1 through route_4
- price_alert_decide: Config: { comparator: "rises_above"|"drops_below"|"crosses_either", target: number, hold_for: "instant"|"60"|"300"|"900" }. Outputs: pa_triggered, pa_current_price, pa_direction
- cooldown_gate: Config: { period: "30"|"60"|"300"|"900"|"3600"|"14400"|"86400", max_triggers: number, reset_on_reversal: boolean }. Outputs: cg_status, cg_triggers_remaining
- multi_condition_gate: Config: { gate_mode: "all"|"any"|"majority", input_count: 2-4, timeout: "none"|"30"|"60"|"300" }. Handles: inputs input_1 through input_4

ACT (actions, category "action"):
- trade_advanced: Config: { platform: "auto"|"polymarket"|"gemini", direction: "auto"|"buy_yes"|"buy_no"|"sell", order_type: "market"|"limit", limit_price: number, mode: "simulate"|"live", only_new: boolean, auto_close: boolean, scale_in: boolean, max_position: number }
- alert_advanced: Config: { ch_app: boolean, ch_sms: boolean, ch_discord: boolean, ch_email: boolean, phone: string, discord_webhook: string, email: string, severity: "info"|"warning"|"critical", message_template: string (supports {{event_name}}, {{edge_value}}, {{probability}}, {{price}}, {{direction}}, {{timestamp}}) }
- strategy_link_act: Config: { target_strategy_id: string, command: "pause"|"resume"|"adjust_sizing"|"signal", size_multiplier: number, signal_value: string }

RULES:
- Every strategy starts with Watch nodes (data sources) and ends with Act nodes.
- Keep strategies minimal. Use edge_calculator after ai_analyst to gate on edge threshold.
- Always include a cooldown_gate before trade_advanced nodes.
- Default connection handles: Watch outputs "output", Act inputs "input", all Think/Decide nodes input "input" output "output" unless specified otherwise above.
- edge_calculator requires analyst_probability (from ai_analyst) and a price field (from a market feed) in the river.
- Set all node positions to {"x": 0, "y": 0} — the system will auto-layout them.

OUTPUT FORMAT — respond with ONLY this JSON:
{
  "nodes": [{ "id": "node_1", "type": "polymarket_feed", "category": "data", "position": { "x": 0, "y": 0 }, "config": {} }],
  "connections": [{ "id": "conn_1", "source_id": "node_1", "source_handle": "output", "target_id": "node_2", "target_handle": "input" }]
}`;

const ALLOWED_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

export async function POST(req: Request) {
  const { prompt, model } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";

  const client = new Anthropic();
  const message = await client.messages.create({
    model: selectedModel,
    max_tokens: 2048,
    system: STRATEGY_GENERATION_SYSTEM,
    messages: [
      { role: "user", content: prompt },
      { role: "assistant", content: "{" },
    ],
  });

  const text = "{" + (message.content[0].type === "text" ? message.content[0].text : "");

  // Try direct parse first, then extract the first JSON object as fallback
  let strategy;
  try {
    strategy = JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }
    strategy = JSON.parse(match[0]);
  }

  // Fix categories: override whatever the LLM set with the canonical category from NODE_TYPES
  if (strategy.nodes) {
    const { NODE_TYPES } = require("@/lib/strategy/node-types");
    for (const node of strategy.nodes) {
      const def = NODE_TYPES[node.type];
      if (def) node.category = def.category;
    }
  }

  // Auto-layout: compute clean, structured positions from graph topology
  if (strategy.nodes && strategy.connections) {
    autoLayoutStrategy(strategy);
  }

  return NextResponse.json(strategy);
}

/**
 * Layout algorithm:
 * 1. Process stages in order: data → ai → logic → action.
 *    No stage-N node appears until all stage-(N-1) nodes are placed.
 * 2. Within a stage, find intra-stage chains (A→B where both are same stage).
 *    Chains get sequential columns. Non-chained nodes stack vertically.
 * 3. Barycenter ordering minimizes edge crossings.
 * 4. Generous spacing prevents vertical overlap.
 */
function autoLayoutStrategy(strategy: { nodes: any[]; connections: any[] }) {
  const COL_GAP_X = 320;
  const NODE_GAP_Y = 300;

  const nodeMap = new Map<string, any>();
  for (const node of strategy.nodes) nodeMap.set(node.id, node);

  // Build adjacency (only among nodes in the strategy)
  const childIds = new Map<string, string[]>();
  const parentIds = new Map<string, string[]>();
  for (const node of strategy.nodes) {
    childIds.set(node.id, []);
    parentIds.set(node.id, []);
  }
  for (const conn of strategy.connections) {
    if (childIds.has(conn.source_id)) childIds.get(conn.source_id)!.push(conn.target_id);
    if (parentIds.has(conn.target_id)) parentIds.get(conn.target_id)!.push(conn.source_id);
  }

  // --- Step 1: Group nodes by stage ---
  const STAGE_ORDER: Record<string, number> = { data: 0, ai: 1, logic: 2, action: 3 };
  const stages: any[][] = [[], [], [], []];
  for (const node of strategy.nodes) {
    stages[STAGE_ORDER[node.category] ?? 0].push(node);
  }

  // --- Step 2: Within each stage, compute intra-stage depth ---
  // For each stage, find the longest chain of intra-stage edges.
  // Nodes at the start of the chain (no intra-stage parent) get depth 0,
  // nodes fed by another same-stage node get depth+1, etc.
  // Nodes at the same intra-stage depth share a column (stacked vertically).

  const columns: any[][] = []; // final ordered list of columns

  for (let s = 0; s <= 3; s++) {
    const stageSet = new Set(stages[s].map((n: any) => n.id));
    if (stageSet.size === 0) continue;

    // Compute intra-stage depth via BFS
    const intraDepth = new Map<string, number>();
    const intraParentCount = new Map<string, number>();

    for (const node of stages[s]) {
      let count = 0;
      for (const pid of parentIds.get(node.id) ?? []) {
        if (stageSet.has(pid)) count++;
      }
      intraParentCount.set(node.id, count);
      if (count === 0) {
        intraDepth.set(node.id, 0);
      }
    }

    // BFS from intra-stage roots
    const q = stages[s].filter((n: any) => intraDepth.has(n.id)).map((n: any) => n.id);
    while (q.length > 0) {
      const id = q.shift()!;
      const d = intraDepth.get(id)!;
      for (const cid of childIds.get(id) ?? []) {
        if (!stageSet.has(cid)) continue;
        if (d + 1 > (intraDepth.get(cid) ?? -1)) intraDepth.set(cid, d + 1);
        // Enqueue when all intra-stage parents are resolved
        const ready = (parentIds.get(cid) ?? [])
          .filter((p) => stageSet.has(p))
          .every((p) => intraDepth.has(p));
        if (ready && !q.includes(cid)) q.push(cid);
      }
    }

    // Fallback for any unassigned
    for (const node of stages[s]) {
      if (!intraDepth.has(node.id)) intraDepth.set(node.id, 0);
    }

    // Group by intra-stage depth
    const depthGroups = new Map<number, any[]>();
    for (const node of stages[s]) {
      const d = intraDepth.get(node.id)!;
      if (!depthGroups.has(d)) depthGroups.set(d, []);
      depthGroups.get(d)!.push(node);
    }

    // Sort depth keys and push as columns
    const depths = Array.from(depthGroups.keys()).sort((a, b) => a - b);
    for (const d of depths) {
      columns.push(depthGroups.get(d)!);
    }
  }

  // --- Step 3: Barycenter ordering to minimize crossings ---
  // Map each node to its (column index, slot index) for y-positioning
  const colOf = new Map<string, number>();
  const ySlot = new Map<string, number>();

  for (let ci = 0; ci < columns.length; ci++) {
    for (let i = 0; i < columns[ci].length; i++) {
      colOf.set(columns[ci][i].id, ci);
      ySlot.set(columns[ci][i].id, i);
    }
  }

  // 6 passes of barycenter sweeps
  for (let pass = 0; pass < 6; pass++) {
    // Left → right
    for (let ci = 1; ci < columns.length; ci++) {
      const col = columns[ci];
      const scored = col.map((node: any) => {
        const pars = (parentIds.get(node.id) ?? []).filter((p) => ySlot.has(p));
        if (pars.length === 0) return { node, bary: ySlot.get(node.id) ?? 0 };
        return { node, bary: pars.reduce((s, p) => s + (ySlot.get(p) ?? 0), 0) / pars.length };
      });
      scored.sort((a, b) => a.bary - b.bary);
      for (let i = 0; i < scored.length; i++) ySlot.set(scored[i].node.id, i);
      columns[ci] = scored.map((s) => s.node);
    }
    // Right → left
    for (let ci = columns.length - 2; ci >= 0; ci--) {
      const col = columns[ci];
      const scored = col.map((node: any) => {
        const kids = (childIds.get(node.id) ?? []).filter((c) => ySlot.has(c));
        if (kids.length === 0) return { node, bary: ySlot.get(node.id) ?? 0 };
        return { node, bary: kids.reduce((s, c) => s + (ySlot.get(c) ?? 0), 0) / kids.length };
      });
      scored.sort((a, b) => a.bary - b.bary);
      for (let i = 0; i < scored.length; i++) ySlot.set(scored[i].node.id, i);
      columns[ci] = scored.map((s) => s.node);
    }
  }

  // --- Step 4: Assign pixel positions ---
  // Find the tallest column to center everything against
  let maxRows = 0;
  for (const col of columns) {
    if (col.length > maxRows) maxRows = col.length;
  }
  const globalTotalH = (maxRows - 1) * NODE_GAP_Y;
  const globalStartY = -globalTotalH / 2;

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    // Center this column's nodes within the global vertical range
    const colTotalH = (col.length - 1) * NODE_GAP_Y;
    const colStartY = globalStartY + (globalTotalH - colTotalH) / 2;
    for (let i = 0; i < col.length; i++) {
      col[i].position = { x: ci * COL_GAP_X, y: Math.round(colStartY + i * NODE_GAP_Y) };
    }
  }
}
