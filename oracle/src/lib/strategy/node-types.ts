// src/lib/strategy/node-types.ts

export interface HandleConfig {
  inputs: string[];
  outputs: string[];
}

export interface NodeTypeDefinition {
  type: string;
  category: "data" | "ai" | "logic" | "action";
  label: string;
  description: string;
  icon: string;
  color: string;
  defaultConfig: Record<string, any>;
  handles: HandleConfig;
  outputKeys: string[];
}

const DATA_COLOR = "#5B7FFF";
const AI_COLOR = "#A855F7";
const LOGIC_COLOR = "#F59E0B";
const ACTION_COLOR = "#00D26A";

export const NODE_TYPES: Record<string, NodeTypeDefinition> = {
  // ─── WATCH NODES (Blue) ───────────────────────────────────────────
  news_monitor: {
    type: "news_monitor",
    category: "data",
    label: "News Monitor",
    description: "Scan news sources with tiered filtering",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { keywords: "", source_tier: "all_major", refresh: "60" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["headline", "source_name", "source_tier", "published_at", "url"],
  },
  polymarket_feed: {
    type: "polymarket_feed",
    category: "data",
    label: "Polymarket Feed",
    description: "Stream live Polymarket pricing and order book data",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { market_search: "", watch_mode: "single", category: "all", max_results: 10 },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["event_title", "market_id", "yes_price", "no_price", "spread", "volume_24h", "liquidity", "last_trade_at", "bids", "asks"],
  },
  gemini_markets_feed: {
    type: "gemini_markets_feed",
    category: "data",
    label: "Gemini Markets",
    description: "Stream live Gemini prediction market data",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { event_search: "", watch_mode: "single", category: "all", max_results: 10, alert_threshold: 5 },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["event_title", "market_id", "instrument_symbol", "contract_price", "bid_price", "ask_price", "last_trade_price", "spread", "liquidity", "event_status", "expiry_date", "category", "significant_move"],
  },
  twitter_monitor: {
    type: "twitter_monitor",
    category: "data",
    label: "X/Twitter Monitor",
    description: "Watch X/Twitter for matching tweets",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { keywords: "", handles: "", min_followers: "1000", verified_only: false, exclude_retweets: true, language: "en" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["tweet_text", "author_handle", "author_followers", "author_verified", "timestamp", "retweet_count", "like_count"],
  },
  crypto_price: {
    type: "crypto_price",
    category: "data",
    label: "Crypto Price",
    description: "Track live cryptocurrency prices",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { token: "BTC", timeframe: "1h" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["current_price", "change_pct", "change_abs", "volume_24h", "high_24h", "low_24h", "token"],
  },
  onchain_activity: {
    type: "onchain_activity",
    category: "data",
    label: "On-Chain Activity",
    description: "Monitor blockchain transactions and whale alerts",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { mode: "whale_alerts", wallet_address: "", min_value: "1000000", chain: "all" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["tx_hash", "from_address", "to_address", "token", "dollar_value", "chain", "block_timestamp"],
  },
  calendar_timer: {
    type: "calendar_timer",
    category: "data",
    label: "Calendar/Timer",
    description: "Fire on a time-based schedule or at specific times",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { mode: "interval", interval: "300", scheduled_time: "09:00", days: ["Mon", "Tue", "Wed", "Thu", "Fri"], fire_at: "" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["fired_at", "fire_reason", "next_fire_at"],
  },
  strategy_link: {
    type: "strategy_link",
    category: "data",
    label: "Strategy Link",
    description: "Read live output from another strategy",
    icon: "",
    color: DATA_COLOR,
    defaultConfig: { strategy_id: "" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["linked_strategy_name", "linked_signal", "linked_edge", "linked_pnl", "linked_status", "linked_last_trade", "linked_position"],
  },

  // ─── THINK NODES (Purple) ─────────────────────────────────────────
  ai_analyst: {
    type: "ai_analyst",
    category: "ai",
    label: "AI Analyst",
    description: "LLM-powered analysis with custom instructions",
    icon: "",
    color: AI_COLOR,
    defaultConfig: { instruction: "", model: "claude-haiku", depth: "balanced", structured: true },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["analyst_probability", "analyst_confidence", "analyst_direction", "analyst_reasoning", "analyst_raw_text"],
  },
  sentiment_scanner: {
    type: "sentiment_scanner",
    category: "ai",
    label: "Sentiment Scanner",
    description: "High-throughput text sentiment classification",
    icon: "",
    color: AI_COLOR,
    defaultConfig: { domain: "general", aggregation: "per_item" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["scanner_sentiment_score", "scanner_magnitude", "scanner_volume_count"],
  },
  consensus: {
    type: "consensus",
    category: "ai",
    label: "Consensus",
    description: "Merge multiple analyses into a weighted signal",
    icon: "",
    color: AI_COLOR,
    defaultConfig: { consensus_mode: "weighted_avg", input_count: 2, weights: [50, 50] },
    handles: { inputs: ["input_1", "input_2", "input_3", "input_4", "input_5"], outputs: ["output"] },
    outputKeys: ["consensus_probability", "consensus_confidence", "consensus_direction", "consensus_disagreement"],
  },
  history_tracker: {
    type: "history_tracker",
    category: "ai",
    label: "History Tracker",
    description: "Track value trends, momentum, and streaks over time",
    icon: "",
    color: AI_COLOR,
    defaultConfig: { track_field: "analyst_probability", depth: 25, time_window: "1h" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["history_current", "history_values", "history_trend", "history_avg", "history_min", "history_max", "history_streak", "history_rate_of_change"],
  },
  formula: {
    type: "formula",
    category: "ai",
    label: "Formula",
    description: "Custom math expressions on numerical inputs",
    icon: "",
    color: AI_COLOR,
    defaultConfig: { formula: "" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["formula_result", "formula_error"],
  },

  // ─── DECIDE NODES (Amber) ─────────────────────────────────────────
  edge_calculator: {
    type: "edge_calculator",
    category: "logic",
    label: "Edge Calculator",
    description: "Compute trading edge with adjustments and position sizing",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { min_edge: 5, decay_halflife: "60", sizing_mode: "fixed", fixed_size: 25, pct_size: 5 },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: [
      "ec_raw_edge", "ec_edge", "ec_edge_pct", "ec_source_weight", "ec_time_decay",
      "ec_liquidity_factor", "ec_direction", "ec_suggested_size", "ec_sizing_mode",
    ],
  },
  arb_detector: {
    type: "arb_detector",
    category: "logic",
    label: "Arb Detector",
    description: "Detect exploitable cross-platform price spreads",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { match_mode: "auto", min_spread: 3, net_of_fees: true },
    handles: { inputs: ["input_1", "input_2"], outputs: ["output"] },
    outputKeys: [
      "arb_spread", "arb_spread_pct", "arb_buy_platform", "arb_sell_platform",
      "arb_buy_price", "arb_sell_price", "arb_profit_estimate",
    ],
  },
  router: {
    type: "router",
    category: "logic",
    label: "Router",
    description: "Route signals to different paths based on conditions",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { routes: [{ label: "Route 1", field: "", comparator: ">", value: "" }, { label: "Route 2", field: "", comparator: "<=", value: "" }] },
    handles: { inputs: ["input"], outputs: ["route_1", "route_2", "route_3", "route_4"] },
    outputKeys: ["_router_active_route", "_router_label"],
  },
  price_alert_decide: {
    type: "price_alert_decide",
    category: "logic",
    label: "Price Alert",
    description: "Trigger when market price crosses a threshold",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { comparator: "rises_above", target: 0.5, hold_for: "instant" },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["pa_triggered", "pa_current_price", "pa_direction", "pa_cross_time"],
  },
  cooldown_gate: {
    type: "cooldown_gate",
    category: "logic",
    label: "Cooldown Gate",
    description: "Rate-limit with max triggers and direction-aware reset",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { period: "300", max_triggers: 3, reset_on_reversal: false },
    handles: { inputs: ["input"], outputs: ["output"] },
    outputKeys: ["cg_status", "cg_cooldown_pct", "cg_remaining", "cg_triggers_remaining"],
  },
  multi_condition_gate: {
    type: "multi_condition_gate",
    category: "logic",
    label: "Multi-Gate",
    description: "AND/OR/Majority gate across multiple inputs",
    icon: "",
    color: LOGIC_COLOR,
    defaultConfig: { gate_mode: "all", input_count: 2, timeout: "none" },
    handles: { inputs: ["input_1", "input_2", "input_3", "input_4"], outputs: ["output"] },
    outputKeys: ["mcg_satisfied", "mcg_input_states", "mcg_mode"],
  },

  // ─── ACT NODES (Green) ────────────────────────────────────────────
  trade_advanced: {
    type: "trade_advanced",
    category: "action",
    label: "Trade",
    description: "Full-featured trade execution with position management",
    icon: "",
    color: ACTION_COLOR,
    defaultConfig: {
      platform: "auto", direction: "auto", order_type: "market", limit_price: 0.5,
      mode: "simulate", only_new: true, auto_close: false, scale_in: false, max_position: 100,
    },
    handles: { inputs: ["input"], outputs: [] },
    outputKeys: [
      "ta_trade_confirmation", "ta_position_qty", "ta_avg_entry",
      "ta_unrealized_pnl", "ta_unrealized_pct", "ta_realized_pnl", "ta_recent_trades",
    ],
  },
  alert_advanced: {
    type: "alert_advanced",
    category: "action",
    label: "Alert",
    description: "Multi-channel notifications with templates",
    icon: "",
    color: ACTION_COLOR,
    defaultConfig: {
      ch_app: true, ch_sms: false, ch_discord: false, ch_email: false,
      phone: "", discord_webhook: "", email: "",
      severity: "info", message_template: "",
    },
    handles: { inputs: ["input"], outputs: [] },
    outputKeys: ["aa_sent", "aa_channels", "aa_message", "aa_timestamp", "aa_recent_alerts"],
  },
  strategy_link_act: {
    type: "strategy_link_act",
    category: "action",
    label: "Strategy Command",
    description: "Send commands to another strategy",
    icon: "",
    color: ACTION_COLOR,
    defaultConfig: { target_strategy_id: "", command: "signal", size_multiplier: 1, signal_value: "" },
    handles: { inputs: ["input"], outputs: [] },
    outputKeys: ["sla_target_name", "sla_target_status", "sla_last_command", "sla_command_time"],
  },
};

export const NODE_CATEGORIES = [
  { key: "data", label: "Data Sources", color: DATA_COLOR },
  { key: "ai", label: "AI & Analysis", color: AI_COLOR },
  { key: "logic", label: "Logic & Control", color: LOGIC_COLOR },
  { key: "action", label: "Actions", color: ACTION_COLOR },
] as const;
