import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const STRATEGY_GENERATION_SYSTEM = `You are a trading strategy architect for the Edge platform. Given a user's natural language description of a prediction market trading strategy, generate a complete node graph.

STEP 1 — UNDERSTAND USER INTENT:
Before generating nodes, analyze the user's prompt to identify the data flow:
1. ENTRY POINT: What starts the pipeline? ("when news breaks" = standalone news_monitor, "every 5 minutes" = standalone calendar_timer)
2. REACTIVE LOOKUPS: Does the pipeline need to fetch data based on what it finds? ("find relevant markets" = reactive polymarket_feed fed by ai_analyst search_terms)
3. ANALYSIS: What thinking happens? ("assess probability" = ai_analyst)
4. DECISION: What gates the action? ("if edge > 5%" = edge_calculator)
5. ACTION: What happens at the end? ("place a trade" = trade_advanced)

KEY: When the user says "when X happens, find Y, then do Z" — X is a standalone data source, Y is a REACTIVE data source (connected downstream from an AI node), Z is an action. The AI analyst sits between X and Y to determine what to search for.

AVAILABLE NODE TYPES:

IMPORTANT — all nodes have both input and output handles. ANY node can connect to ANY other node. Data sources can receive upstream input to drive dynamic searches. When a data source has incoming connections, upstream river fields override its static config — for example, if an upstream node outputs search_terms: "Trump election", a connected polymarket_feed uses that as its market_search instead of whatever is in its config. Data sources with NO incoming connections are standalone entry points. Data sources WITH incoming connections are reactive and run when their upstream feeds them data.

WATCH (data sources, category "data"):
- news_monitor: Config: { keywords: string, source_tier: "top"|"all_major"|"everything", refresh: "realtime"|"30"|"60"|"300" }. Outputs: headline, source_name, source_tier, published_at, url. Reactive override: upstream search_terms → keywords
- polymarket_feed: Config: { market_search: string, watch_mode: "single"|"category", category: "all"|"politics"|"crypto"|"sports"|"economics"|"culture"|"world", max_results: number }. Outputs: event_title, market_id, yes_price, no_price, spread, volume_24h, liquidity, available_markets (array of all results). Reactive override: upstream search_terms → market_search
- gemini_markets_feed: Config: { event_search: string, watch_mode: "single"|"category", category: same as above, max_results: number, alert_threshold: number }. Outputs: event_title, market_id, instrument_symbol, contract_price, bid_price, ask_price, spread, liquidity, expiry_date, significant_move, available_markets. Reactive override: upstream search_terms → event_search
- twitter_monitor: Config: { keywords: string, handles: string, min_followers: string, verified_only: boolean, exclude_retweets: boolean, language: string }. Outputs: tweet_text, author_handle, author_followers, timestamp. Reactive override: upstream search_terms → keywords
- crypto_price: Config: { token: "BTC"|"ETH"|"SOL"|etc, timeframe: "1m"|"5m"|"15m"|"1h"|"4h"|"24h" }. Outputs: current_price, change_pct, change_abs, volume_24h, high_24h, low_24h, token
- onchain_activity: Config: { mode: "watch_wallet"|"whale_alerts", wallet_address: string, min_value: string, chain: "all"|"ethereum"|"bitcoin"|"solana" }. Outputs: tx_hash, from_address, to_address, token, dollar_value, chain
- calendar_timer: Config: { mode: "interval"|"scheduled"|"one_shot", interval: "30"|"60"|"300"|"900"|"3600"|"14400"|"86400", scheduled_time: string, days: string[], fire_at: string }. Outputs: fired_at, fire_reason, next_fire_at
- strategy_link: Config: { strategy_id: string }. Outputs: linked_strategy_name, linked_signal, linked_edge, linked_pnl, linked_status

THINK (AI/analysis, category "ai"):
- ai_analyst: Config: { instruction: string, model: "claude-haiku"|"claude-sonnet"|"claude-opus", depth: "fast"|"balanced"|"thorough", structured: boolean }. Outputs: analyst_probability (0-1), analyst_confidence, analyst_direction, analyst_reasoning, analyst_market_title, search_terms. NOTE: The AI analyst ONLY analyzes data — it does NOT search for markets. To find markets, place a reactive market feed (polymarket_feed, gemini_markets_feed) downstream and feed it the analyst's search_terms output. When available_markets are in the river from an upstream feed, the analyst uses them to inform its probability estimate.
- sentiment_scanner: Config: { domain: "general"|"crypto"|"political"|"financial"|"sports", aggregation: "per_item"|"5m"|"15m"|"1h" }. Outputs: scanner_sentiment_score (-100 to 100), scanner_magnitude, scanner_volume_count. NOTE: Analyzes TEXT for emotional tone. Only connect to text-producing sources (news_monitor, twitter_monitor). Do NOT connect market feeds (polymarket_feed, gemini_markets_feed) — their event titles are neutral questions with no sentiment to extract.
- consensus: Config: { consensus_mode: "weighted_avg"|"majority", input_count: 2-5, weights: number[] }. Handles: inputs input_1 through input_5. Outputs: consensus_probability, consensus_confidence, consensus_direction, consensus_disagreement. NOTE: Averages probability values (0-1). ALL inputs must produce probability-like values. Do NOT mix sentiment_scanner output with ai_analyst output — sentiment scores are NOT probabilities. For multiple probability sources, use multiple ai_analyst nodes with different models/configs.
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

Structure:
- Every strategy starts with Watch nodes (data sources) and ends with Act nodes.
- Keep strategies minimal — prefer fewer, well-connected nodes over many loosely connected ones.
- Set all node positions to {"x": 0, "y": 0} — the system will auto-layout them.
- Default connection handles: Watch outputs "output", Act inputs "input", all Think/Decide nodes input "input" output "output" unless specified otherwise above.

Data source connectivity:
- Data sources with NO incoming connections are standalone entry points (they fire the pipeline).
- Data sources WITH incoming connections are reactive — they use upstream data to drive their search/fetch. Use this for dynamic pipelines: e.g., ai_analyst → polymarket_feed where the AI outputs search_terms that the feed uses.
- A strategy MUST have at least one standalone data source (no inputs) as its entry point.
- For "when event X happens → find relevant market Y" strategies, use TWO ai_analyst nodes:
  event_source → ai_analyst_1 (extracts search_terms from the event) → reactive market_feed (uses search_terms to find markets) → ai_analyst_2 (sees BOTH the event data AND the actual market, estimates probability) → edge_calculator → cooldown_gate → actions
  WHY two analysts: ai_analyst_1 only determines WHAT markets to look for — it cannot estimate a meaningful probability without knowing the specific market question. ai_analyst_2 sees both the original event AND the actual market (event_title, yes_price, available_markets) in its river, so it can estimate the TRUE probability for that specific market.
- ANTI-PATTERN: Do NOT connect ai_analyst directly to edge_calculator when the strategy starts from an event source and needs to discover markets. The analyst's probability is meaningless without knowing which specific market it applies to.
- ANTI-PATTERN: Do NOT create a standalone market feed that connects directly to edge_calculator when the strategy starts from an event source. The market feed MUST be downstream of ai_analyst_1 so it receives search_terms and becomes a reactive lookup.

Connections:
- ANY node can connect to ANY other node. There are no category restrictions.
- Every Act node (trade_advanced, alert_advanced, strategy_link_act) MUST have at least one incoming connection.
- Do NOT create nodes with no connections — every node must participate in the graph.
- Every non-action node must have at least one outgoing connection (otherwise it's a dead end producing data that goes nowhere).
- Data accumulates through the chain: if node A outputs search_terms, and A → B → C, then C's river includes search_terms even though B didn't produce it. You do NOT need direct skip connections to pass data through — it flows through intermediate nodes automatically.

Node selection:
- price_alert_decide: Use for ABSOLUTE price thresholds ("when BTC crosses $70,000", "when yes_price drops below 0.3"). Do NOT use for percentage changes.
- router: Use for CONDITIONAL branching on any field ("if change_pct > 3", "if sentiment > 50", "if consensus_disagreement == false"). Use this for percentage-based conditions or boolean gating.
- formula: Use for computing derived values ("abs(change_pct)", "yes_price * volume_24h").
- edge_calculator: Use specifically for probability-vs-market-price edge with gating. Not a general-purpose comparator.
- consensus: Use to merge multiple signals AND detect agreement. consensus_disagreement tells you if inputs conflict. Connect consensus → router (gate on consensus_disagreement == false) to enforce agreement.

Atomicity — CRITICAL:
- Every node does ONE job. Prefer more nodes with simple configs over fewer nodes with complex configs.
- NEVER put conditional logic, multi-step reasoning, or redundant checks into ai_analyst instructions. If a check is deterministic (comparing numbers, checking agreement, threshold gating), use a logic node (router, formula, multi_condition_gate, consensus) instead.
- ai_analyst instructions should be 1-2 sentences. If an instruction has "if X then do Y, otherwise do Z" logic, break it into a logic node (router/gate) + separate ai_analyst nodes on each branch.
- BAD: ai_analyst instruction "Check if both sentiments agree. If they do, find markets. If not, set confidence low." → This bakes a logic check into an AI call.
- GOOD: consensus (detects agreement) → router (gates on agreement) → ai_analyst "Find relevant markets" → ... The logic check is a logic node; the AI just does analysis.

Data flow — edge_calculator:
- edge_calculator requires BOTH a probability (analyst_probability or consensus_probability) AND a market price (yes_price, contract_price, current_price) in its river.
- The probability and price MUST be about the SAME market. This means the ai_analyst that estimates probability must have the market data (event_title, yes_price) in its river — i.e., the market feed must be UPSTREAM of the probability-estimating analyst, not parallel to it.
- Do NOT connect an ai_analyst directly to edge_calculator while also connecting a separate market feed to edge_calculator — this creates mismatched probability/price pairs.
- Always include a cooldown_gate between edge_calculator and trade_advanced.

Data flow — ai_analyst:
- Each ai_analyst does ONE job. Use multiple ai_analyst nodes with different short instructions rather than one node with a long instruction.
- Two common roles:
  Role A — "Search term extractor": Outputs search_terms for downstream market feeds. Instruction should be specific to the strategy's domain and produce targeted multi-word phrases. Example: "Based on the incoming news, output search_terms — a specific 2-4 word phrase identifying the most directly affected prediction markets. Be precise: prefer 'OpenAI GPT-5 release' over generic terms like 'AI'."
  Role B — "Market picker + probability estimator": Sees event data + AVAILABLE MARKETS list from upstream feed. Picks the most relevant market (selected_market) and estimates its true probability. Instruction: "Review the available markets. Pick the one most affected by the upstream data (set selected_market to its number). Estimate the true probability of that market. If none are relevant, set probability to 0.5."
- For event-driven strategies: event_source → [optional logic nodes] → ai_analyst(Role A) → reactive market feed → ai_analyst(Role B) → edge_calculator.
- For market-monitoring strategies: standalone market_feed → ai_analyst(Role B) → edge_calculator.
- Instructions should be 1-2 sentences. No conditional logic — use logic nodes for that.
- Instructions should NEVER presume the input type — they should work with whatever data arrives.

Data flow — sentiment_scanner:
- sentiment_scanner only works with text sources (news_monitor, twitter_monitor). NEVER connect it to polymarket_feed or gemini_markets_feed.

Data flow — consensus:
- Only use consensus when you have 2+ sources that produce PROBABILITY values (0-1). Do NOT mix sentiment scores with probabilities.
- Good consensus inputs: multiple ai_analyst nodes, ai_analyst + formula that converts a signal to probability.
- Bad consensus inputs: ai_analyst + sentiment_scanner (different scales and semantics).

FIELD COMPATIBILITY — nodes read specific named fields from the river. If a required field is missing, the node either blocks (_gate_result: false) or returns a safe default. Data accumulates through the chain: if A → B → C, then C sees all fields from A and B.

What each node WRITES to the river:
- news_monitor → headline, source_name, source_tier, published_at, url
- polymarket_feed → event_title, market_id, yes_price, no_price, spread, volume_24h, liquidity, available_markets
- gemini_markets_feed → event_title, market_id, instrument_symbol, contract_price, bid_price, ask_price, spread, liquidity, expiry_date
- twitter_monitor → tweet_text, author_handle, author_followers, timestamp
- crypto_price → current_price, change_pct, change_abs, volume_24h, high_24h, low_24h, token
- onchain_activity → tx_hash, from_address, to_address, token, dollar_value, chain, block_timestamp
- calendar_timer → fired_at, fire_reason, next_fire_at
- ai_analyst → analyst_probability, analyst_confidence, analyst_direction, analyst_reasoning, search_terms, analyst_market_title
- sentiment_scanner → scanner_sentiment_score, scanner_magnitude, scanner_volume_count
- consensus → consensus_probability, consensus_confidence, consensus_direction, consensus_disagreement
- history_tracker → history_current, history_values, history_trend, history_avg, history_streak, history_rate_of_change
- formula → formula_result, formula_error
- edge_calculator → ec_raw_edge, ec_edge, ec_edge_pct, ec_source_weight, ec_direction, ec_suggested_size (also gates: blocks downstream if edge < min_edge)
- cooldown_gate → cg_status, cg_triggers_remaining (also gates: blocks downstream if rate limit hit)
- router → _router_active_route, _router_label (routes to specific output handles)
- price_alert_decide → pa_triggered, pa_current_price, pa_direction (also gates: blocks if price hasn't crossed target)
- trade_advanced → ta_trade_confirmation, ta_position_qty, ta_avg_entry, ta_unrealized_pnl
- alert_advanced → aa_sent, aa_channels, aa_message, aa_timestamp

What each downstream node READS from the river (must be present for the node to work):
- ai_analyst: reads ALL upstream fields as context for the LLM. No specific field required, but more context = better analysis.
- sentiment_scanner: REQUIRES at least one text field: headline OR tweet_text OR event_title OR description. Returns 0 if none found.
- consensus: reads EXACTLY these fields: analyst_probability, consensus_probability, calibrated_probability, formula_result, scanner_sentiment_score. Ignores everything else.
- edge_calculator: REQUIRES analyst_probability OR consensus_probability (probability). REQUIRES yes_price OR contract_price OR current_price (market price). Blocks if either is missing. Also reads analyst_confidence/consensus_confidence for weighting, volume_24h/liquidity for liquidity factor.
- cooldown_gate: reads ec_direction OR analyst_direction OR direction (for reset_on_reversal).
- price_alert_decide: REQUIRES yes_price OR contract_price OR current_price. Blocks if missing.
- trade_advanced: reads yes_price/contract_price/current_price (price), ec_direction/direction (direction), ec_suggested_size (size), market_id/instrument_symbol (market). Defaults safely if missing.
- alert_advanced: reads event_title/headline (event name), ec_edge_pct, analyst_probability, yes_price/contract_price/current_price, ec_direction/analyst_direction for template variables.
- formula: reads any numeric river field by name in the formula expression.
- history_tracker: reads the field specified in track_field config.

KEY RULES for connecting nodes:
- edge_calculator needs BOTH probability AND price. Probability comes from ai_analyst or consensus. Price comes from a market feed (polymarket_feed, gemini_markets_feed, crypto_price). Both must be upstream.
- ai_analyst does NOT output price. It outputs analyst_probability and search_terms.
- sentiment_scanner needs text input. Only connect it to: news_monitor, twitter_monitor. NEVER to market feeds.
- consensus only reads probability-like fields. Do NOT mix it with non-probability sources.
- Reactive data sources (with incoming connections) use upstream search_terms to drive their search. Only search_terms overrides the config — no other river fields affect the config.
- formula_result is read by consensus but NOT by edge_calculator. To feed formula into edge, pipe through consensus first.
- When using formula to convert sentiment to probability for consensus: "(scanner_sentiment_score + 100) / 200".

Trading:
- Default trade_advanced mode to "simulate" unless the user explicitly requests live trading.
- Use reasonable max_position values ($25-$100 for typical strategies, not $5).

COMMON PATTERNS:

Single-source event-driven (news/tweets/whale moves → find and trade markets):
  news_monitor → ai_analyst_1 ("Output search_terms for affected markets.") → polymarket_feed (reactive, max_results: 5) → ai_analyst_2 ("Pick the most relevant market and estimate its probability.") → edge_calculator → cooldown_gate → trade_advanced + alert_advanced
  ai_analyst_2 sees AVAILABLE MARKETS (up to 5), picks the best one via selected_market, and estimates probability for that specific market. Downstream nodes automatically use the selected market's price and ID.

Multi-source with agreement check (only act when sources agree):
  news_monitor → sentiment_scanner_1 ─┐
                                        consensus (detects agreement)
  twitter_monitor → sentiment_scanner_2 ┘
  consensus → router (gate: consensus_disagreement == false) → ai_analyst_1 ("Output search_terms.") → polymarket_feed (reactive) → ai_analyst_2 ("Pick most relevant market and estimate probability.") → edge_calculator → cooldown_gate → trade_advanced
  Logic nodes handle the agreement check. AI nodes only do analysis.

Market-monitoring (react to price movements):
  polymarket_feed (standalone) → price_alert_decide → ai_analyst ("Estimate probability.") → edge_calculator → cooldown_gate → trade_advanced

Simple alert (no AI, no trading):
  crypto_price → router (if change_pct > 5 or < -5) → alert_advanced
  Use logic nodes for threshold checks. Not everything needs AI.

Cross-platform arbitrage:
  polymarket_feed (standalone) → arb_detector ← gemini_markets_feed (standalone)
  arb_detector → cooldown_gate → trade_advanced

OUTPUT FORMAT — respond with ONLY this JSON:
{
  "name": "Short, punchy strategy name (2-5 words, no quotes)",
  "nodes": [{ "id": "node_1", "type": "polymarket_feed", "category": "data", "position": { "x": 0, "y": 0 }, "config": {} }],
  "connections": [{ "id": "conn_1", "source_id": "node_1", "source_handle": "output", "target_id": "node_2", "target_handle": "input" }]
}

The "name" field should be a concise, descriptive title for the strategy based on what it does. Examples: "News Edge Hunter", "Crypto Momentum Scalper", "Election Alpha Tracker", "Cross-Market Arb Bot".`;

const ALLOWED_MODELS = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-opus-4-6",
];

const EDIT_STRATEGY_ADDENDUM = `

EDIT MODE — you are modifying an existing strategy, NOT creating from scratch.

You will receive the current strategy as JSON under "CURRENT STRATEGY:" in the user message. The user's prompt describes what changes they want.

RULES FOR EDITING:
- PRESERVE existing node IDs. Do not rename or regenerate IDs for nodes you keep.
- PRESERVE existing connections that are still valid after your changes.
- You may ADD new nodes (use ids like "node_new_1", "node_new_2", etc.).
- You may REMOVE nodes by simply not including them in the output.
- You may MODIFY node configs by changing their config fields.
- You may ADD or REMOVE connections as needed.
- You may REORDER or restructure the flow if the user asks.
- Set positions to {"x": 0, "y": 0} for any new nodes — the system will re-layout everything.
- Keep positions for existing nodes if their topology hasn't changed, otherwise set to {"x": 0, "y": 0}.
- The name should be updated only if the user's change fundamentally alters what the strategy does. Otherwise keep the existing name.

Output the COMPLETE modified strategy in the same JSON format (all nodes, all connections, name). Do NOT output only the diff — output the full final strategy.`;

export async function POST(req: Request) {
  const { prompt, model, existingStrategy } = await req.json();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const selectedModel = ALLOWED_MODELS.includes(model) ? model : "claude-haiku-4-5-20251001";
  const isEditMode = existingStrategy && existingStrategy.nodes?.length > 0;

  const systemPrompt = isEditMode
    ? STRATEGY_GENERATION_SYSTEM + EDIT_STRATEGY_ADDENDUM
    : STRATEGY_GENERATION_SYSTEM;

  // Build the user message — include existing strategy context for edit mode
  const userMessage = isEditMode
    ? `CURRENT STRATEGY:\n${JSON.stringify(existingStrategy, null, 2)}\n\nREQUESTED CHANGES:\n${prompt}`
    : prompt;

  const client = new Anthropic();
  // Haiku supports assistant prefill to force JSON; Sonnet/Opus do not
  const supportsPrefill = selectedModel.includes("haiku");
  const messages: Anthropic.MessageParam[] = supportsPrefill
    ? [{ role: "user", content: userMessage }, { role: "assistant", content: "{" }]
    : [{ role: "user", content: userMessage }];

  let message;
  try {
    message = await client.messages.create({
      model: selectedModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    const status = err?.status || 502;
    return NextResponse.json(
      { error: `AI model error (${selectedModel}): ${msg}` },
      { status }
    );
  }

  const raw = message.content[0].type === "text" ? message.content[0].text : "";
  const text = supportsPrefill ? "{" + raw : raw;

  // Try direct parse first, then extract the first JSON object as fallback
  let strategy;
  try {
    strategy = JSON.parse(text.trim());
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }
    try {
      strategy = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: text }, { status: 500 });
    }
  }

  // Fix categories: override whatever the LLM set with the canonical category from NODE_TYPES
  if (strategy.nodes) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NODE_TYPES } = require("@/lib/strategy/node-types");
    for (const node of strategy.nodes) {
      const def = NODE_TYPES[node.type];
      if (def) node.category = def.category;
    }
  }

  // Post-processing: enforce structural rules the LLM may have missed
  if (strategy.nodes && strategy.connections) {
    enforceStrategyRules(strategy, prompt);
  }

  // Auto-layout: compute clean, structured positions from graph topology
  if (strategy.nodes && strategy.connections) {
    autoLayoutStrategy(strategy);
  }

  return NextResponse.json(strategy);
}

/**
 * Enforce structural rules that the LLM may not have followed.
 * Runs after JSON parse but before layout.
 */
function enforceStrategyRules(strategy: { nodes: any[]; connections: any[] }, _userPrompt: string) {
  const MARKET_FEED_TYPES = new Set(["polymarket_feed", "gemini_markets_feed"]);
  const EVENT_SOURCE_TYPES = new Set(["news_monitor", "twitter_monitor", "onchain_activity", "calendar_timer"]);

  // --- Rule 1: trade_advanced defaults to simulate ---
  for (const node of strategy.nodes) {
    if (node.type === "trade_advanced" && node.config?.mode === "live") {
      node.config.mode = "simulate";
    }
  }

  // --- Rule 2: Event-driven strategies must use reactive market feeds ---
  // Detects: event_source → ai_analyst → edge_calculator ← market_feed (standalone)
  // Fixes to: event_source → ai_analyst → market_feed (reactive) → edge_calculator
  {
    const incomingSet = new Set(strategy.connections.map((c: any) => c.target_id));
    const standaloneEventSources = strategy.nodes.filter(
      (n: any) => EVENT_SOURCE_TYPES.has(n.type) && !incomingSet.has(n.id)
    );
    const standaloneMarketFeeds = strategy.nodes.filter(
      (n: any) => MARKET_FEED_TYPES.has(n.type) && !incomingSet.has(n.id)
    );
    const aiAnalysts = strategy.nodes.filter((n: any) => n.type === "ai_analyst");
    const edgeCalcs = strategy.nodes.filter((n: any) => n.type === "edge_calculator");

    if (standaloneEventSources.length > 0 && standaloneMarketFeeds.length > 0 && aiAnalysts.length > 0 && edgeCalcs.length > 0) {
      for (const ai of aiAnalysts) {
        // Check that this ai_analyst receives from a standalone event source
        const aiInputs = strategy.connections
          .filter((c: any) => c.target_id === ai.id)
          .map((c: any) => c.source_id);
        const hasEventInput = aiInputs.some((srcId: string) =>
          standaloneEventSources.some((e: any) => e.id === srcId)
        );
        if (!hasEventInput) continue;

        for (const mf of standaloneMarketFeeds) {
          // Find: standalone market_feed → edge_calculator (direct connection)
          const mfToEdge = strategy.connections.find(
            (c: any) => c.source_id === mf.id && edgeCalcs.some((e: any) => e.id === c.target_id)
          );
          if (!mfToEdge) continue;

          // Skip if market feed already feeds into ai_analyst
          const mfToAI = strategy.connections.find(
            (c: any) => c.source_id === mf.id && c.target_id === ai.id
          );
          if (mfToAI) continue;

          const edgeCalcId = mfToEdge.target_id;

          // 1. Remove market_feed → edge_calculator
          strategy.connections = strategy.connections.filter((c: any) => c !== mfToEdge);

          // 2. Remove ai_analyst → edge_calculator (if direct connection exists)
          strategy.connections = strategy.connections.filter(
            (c: any) => !(c.source_id === ai.id && c.target_id === edgeCalcId)
          );

          // 3. Add ai_analyst → market_feed (makes it reactive)
          strategy.connections.push({
            id: `conn_reactive_${ai.id}_${mf.id}`,
            source_id: ai.id,
            source_handle: "output",
            target_id: mf.id,
            target_handle: "input",
          });

          // 4. Add market_feed → edge_calculator
          strategy.connections.push({
            id: `conn_reactive_${mf.id}_${edgeCalcId}`,
            source_id: mf.id,
            source_handle: "output",
            target_id: edgeCalcId,
            target_handle: "input",
          });
        }
      }
    }
  }

  // --- Rule 4: All action nodes must have incoming connections ---
  const targetIds = new Set(strategy.connections.map((c: any) => c.target_id));
  const actionNodes = strategy.nodes.filter((n: any) => n.category === "action");
  const lastLogicOrAI = [...strategy.connections]
    .reverse()
    .find((c: any) => {
      const srcNode = strategy.nodes.find((n: any) => n.id === c.source_id);
      return srcNode && (srcNode.category === "logic" || srcNode.category === "ai");
    });

  for (const action of actionNodes) {
    if (!targetIds.has(action.id) && lastLogicOrAI) {
      // Connect orphaned action node from the last logic/ai node's source
      strategy.connections.push({
        id: `conn_fix_${action.id}`,
        source_id: lastLogicOrAI.source_id,
        source_handle: "output",
        target_id: action.id,
        target_handle: "input",
      });
    }
  }

  // --- Rule 5: Remove dead-end non-action nodes (have input but no output connections) ---
  const sourceIds = new Set(strategy.connections.map((c: any) => c.source_id));
  const standaloneDataIds = new Set(
    strategy.nodes
      .filter((n: any) => n.category === "data" && !targetIds.has(n.id))
      .map((n: any) => n.id)
  );
  const deadEnds = strategy.nodes.filter(
    (n: any) =>
      n.category !== "action" &&
      !standaloneDataIds.has(n.id) &&
      targetIds.has(n.id) &&
      !sourceIds.has(n.id)
  );
  for (const dead of deadEnds) {
    // Remove the node and its incoming connections
    strategy.nodes = strategy.nodes.filter((n: any) => n.id !== dead.id);
    strategy.connections = strategy.connections.filter(
      (c: any) => c.source_id !== dead.id && c.target_id !== dead.id
    );
  }

  // --- Rule 6: AI analyst nodes default to Haiku ---
  for (const node of strategy.nodes) {
    if (node.type === "ai_analyst") {
      node.config = node.config || {};
      node.config.model = "claude-haiku";
    }
  }

  // --- Rule 7: Reasonable max_position ---
  for (const node of strategy.nodes) {
    if (node.type === "trade_advanced" && node.config?.max_position != null) {
      if (node.config.max_position < 10) {
        node.config.max_position = 50;
      }
    }
  }
}

/**
 * Layout algorithm — topological flow, not category-based.
 *
 * 1. Longest-path ranking ensures every node is to the right of all its parents.
 * 2. Promote single-child chains: if a column has 1 node and its only child is
 *    also alone in the next column, they stay as separate columns (clear flow).
 *    But if a column is overloaded (3+ nodes), spread them by promoting nodes
 *    whose parents allow it into their own column.
 * 3. Barycenter sweeps minimize edge crossings.
 * 4. Generous spacing with no overlap.
 */
function autoLayoutStrategy(strategy: { nodes: any[]; connections: any[] }) {
  const COL_GAP_X = 350;
  const NODE_GAP_Y = 250;
  const MAX_PER_COL = 3; // if a column has more than this, promote nodes forward

  // Build adjacency
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

  // --- Step 1: Longest-path depth assignment ---
  const rank = new Map<string, number>();
  const inDeg = new Map<string, number>();
  for (const node of strategy.nodes) {
    rank.set(node.id, 0);
    inDeg.set(node.id, (parentIds.get(node.id) ?? []).length);
  }

  const queue = strategy.nodes.filter((n) => inDeg.get(n.id) === 0).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.shift()!;
    const d = rank.get(id)!;
    for (const cid of childIds.get(id) ?? []) {
      if (d + 1 > (rank.get(cid) ?? 0)) rank.set(cid, d + 1);
      const rem = inDeg.get(cid)! - 1;
      inDeg.set(cid, rem);
      if (rem === 0) queue.push(cid);
    }
  }

  // --- Step 2: Build columns, then spread overloaded ones ---
  const maxRank = Math.max(0, ...Array.from(rank.values()));
  let columns: any[][] = Array.from({ length: maxRank + 1 }, () => []);
  for (const node of strategy.nodes) {
    columns[rank.get(node.id) ?? 0].push(node);
  }

  // Promote: if a column has too many nodes, push some forward into a new column.
  // A node can be promoted if doing so doesn't violate the constraint that it must
  // be after all its parents (i.e., its rank stays > max parent rank).
  const finalColumns: any[][] = [];
  for (let ci = 0; ci < columns.length; ci++) {
    if (columns[ci].length <= MAX_PER_COL) {
      finalColumns.push(columns[ci]);
      continue;
    }
    // Split: keep first MAX_PER_COL, promote the rest to a new inserted column
    const keep = columns[ci].slice(0, MAX_PER_COL);
    const promote = columns[ci].slice(MAX_PER_COL);
    finalColumns.push(keep);
    finalColumns.push(promote);
  }
  columns = finalColumns;

  // Remove empty columns
  columns = columns.filter((col) => col.length > 0);

  // --- Step 3: Barycenter ordering ---
  const ySlot = new Map<string, number>();
  for (let ci = 0; ci < columns.length; ci++) {
    for (let i = 0; i < columns[ci].length; i++) {
      ySlot.set(columns[ci][i].id, i);
    }
  }

  for (let pass = 0; pass < 8; pass++) {
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
  let maxRows = 0;
  for (const col of columns) {
    if (col.length > maxRows) maxRows = col.length;
  }
  const globalTotalH = (maxRows - 1) * NODE_GAP_Y;
  const globalStartY = -globalTotalH / 2;

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    const colTotalH = (col.length - 1) * NODE_GAP_Y;
    const colStartY = globalStartY + (globalTotalH - colTotalH) / 2;
    for (let i = 0; i < col.length; i++) {
      col[i].position = { x: ci * COL_GAP_X, y: Math.round(colStartY + i * NODE_GAP_Y) };
    }
  }
}
