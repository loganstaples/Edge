// src/lib/strategy/templates.ts
import type { StrategyNode, StrategyConnection } from "@/types";

export interface StrategyTemplate {
  name: string;
  description: string;
  icon: string;
  nodes: StrategyNode[];
  connections: StrategyConnection[];
}

export const TEMPLATES: StrategyTemplate[] = [
  {
    name: "Edge Trader",
    description: "AI analyzes markets, trades when edge exceeds threshold",
    icon: "📊",
    nodes: [
      { id: "t1_1", type: "polymarket_feed", category: "data", position: { x: 0, y: 0 }, config: { market_search: "", watch_mode: "category", category: "all", max_results: 10 } },
      { id: "t1_2", type: "ai_analyst", category: "ai", position: { x: 250, y: 0 }, config: { instruction: "Estimate the probability of this event occurring based on available evidence.", model: "claude-haiku", depth: "balanced", structured: true } },
      { id: "t1_3", type: "edge_calculator", category: "logic", position: { x: 500, y: 0 }, config: { min_edge: 10, decay_halflife: "60", sizing_mode: "fixed", fixed_size: 25 } },
      { id: "t1_4", type: "cooldown_gate", category: "logic", position: { x: 750, y: 0 }, config: { period: "300", max_triggers: 3, reset_on_reversal: false } },
      { id: "t1_5", type: "trade_advanced", category: "action", position: { x: 1000, y: 0 }, config: { platform: "auto", direction: "auto", order_type: "market", mode: "simulate", only_new: true, max_position: 100 } },
    ],
    connections: [
      { id: "t1_c1", source_id: "t1_1", source_handle: "output", target_id: "t1_2", target_handle: "input" },
      { id: "t1_c2", source_id: "t1_2", source_handle: "output", target_id: "t1_3", target_handle: "input" },
      { id: "t1_c3", source_id: "t1_3", source_handle: "output", target_id: "t1_4", target_handle: "input" },
      { id: "t1_c4", source_id: "t1_4", source_handle: "output", target_id: "t1_5", target_handle: "input" },
    ],
  },
  {
    name: "News Reactive",
    description: "Trade when breaking news creates an edge with high confidence",
    icon: "📰",
    nodes: [
      { id: "t2_1", type: "news_monitor", category: "data", position: { x: 0, y: 0 }, config: { keywords: "", source_tier: "top", refresh: "30" } },
      { id: "t2_2", type: "ai_analyst", category: "ai", position: { x: 250, y: 0 }, config: { instruction: "Based on this breaking news, estimate its impact on related prediction markets.", model: "claude-haiku", depth: "thorough", structured: true } },
      { id: "t2_3", type: "edge_calculator", category: "logic", position: { x: 500, y: 0 }, config: { min_edge: 15, decay_halflife: "15", sizing_mode: "kelly" } },
      { id: "t2_4", type: "cooldown_gate", category: "logic", position: { x: 750, y: 0 }, config: { period: "300", max_triggers: 2 } },
      { id: "t2_5", type: "trade_advanced", category: "action", position: { x: 1000, y: 0 }, config: { platform: "auto", direction: "auto", mode: "simulate" } },
    ],
    connections: [
      { id: "t2_c1", source_id: "t2_1", source_handle: "output", target_id: "t2_2", target_handle: "input" },
      { id: "t2_c2", source_id: "t2_2", source_handle: "output", target_id: "t2_3", target_handle: "input" },
      { id: "t2_c3", source_id: "t2_3", source_handle: "output", target_id: "t2_4", target_handle: "input" },
      { id: "t2_c4", source_id: "t2_4", source_handle: "output", target_id: "t2_5", target_handle: "input" },
    ],
  },
  {
    name: "Price Watcher",
    description: "Alert when a market price crosses a threshold",
    icon: "🔔",
    nodes: [
      { id: "t3_1", type: "polymarket_feed", category: "data", position: { x: 0, y: 0 }, config: { market_search: "", watch_mode: "single", max_results: 1 } },
      { id: "t3_2", type: "price_alert_decide", category: "logic", position: { x: 250, y: 0 }, config: { comparator: "drops_below", target: 0.2, hold_for: "instant" } },
      { id: "t3_3", type: "alert_advanced", category: "action", position: { x: 500, y: 0 }, config: { ch_app: true, severity: "warning", message_template: "Price alert: {{event_name}} dropped to {{price}}" } },
    ],
    connections: [
      { id: "t3_c1", source_id: "t3_1", source_handle: "output", target_id: "t3_2", target_handle: "input" },
      { id: "t3_c2", source_id: "t3_2", source_handle: "output", target_id: "t3_3", target_handle: "input" },
    ],
  },
  {
    name: "Sentiment Contrarian",
    description: "Fade extreme crowd sentiment when AI probability disagrees",
    icon: "🧠",
    nodes: [
      { id: "t4_1", type: "twitter_monitor", category: "data", position: { x: 0, y: 0 }, config: { keywords: "", min_followers: "10000", verified_only: false, exclude_retweets: true, language: "en" } },
      { id: "t4_2", type: "sentiment_scanner", category: "ai", position: { x: 250, y: 0 }, config: { domain: "general", aggregation: "15m" } },
      { id: "t4_3", type: "ai_analyst", category: "ai", position: { x: 250, y: 120 }, config: { instruction: "Given this sentiment data, estimate the true probability. Crowd extremes often represent opportunities.", model: "claude-haiku", depth: "balanced", structured: true } },
      { id: "t4_4", type: "consensus", category: "ai", position: { x: 500, y: 60 }, config: { consensus_mode: "weighted_avg", input_count: 2, weights: [40, 60] } },
      { id: "t4_5", type: "edge_calculator", category: "logic", position: { x: 750, y: 60 }, config: { min_edge: 15, sizing_mode: "proportional" } },
      { id: "t4_6", type: "trade_advanced", category: "action", position: { x: 1000, y: 60 }, config: { platform: "auto", direction: "auto", mode: "simulate" } },
    ],
    connections: [
      { id: "t4_c1", source_id: "t4_1", source_handle: "output", target_id: "t4_2", target_handle: "input" },
      { id: "t4_c2", source_id: "t4_1", source_handle: "output", target_id: "t4_3", target_handle: "input" },
      { id: "t4_c3", source_id: "t4_2", source_handle: "output", target_id: "t4_4", target_handle: "input_1" },
      { id: "t4_c4", source_id: "t4_3", source_handle: "output", target_id: "t4_4", target_handle: "input_2" },
      { id: "t4_c5", source_id: "t4_4", source_handle: "output", target_id: "t4_5", target_handle: "input" },
      { id: "t4_c6", source_id: "t4_5", source_handle: "output", target_id: "t4_6", target_handle: "input" },
    ],
  },
  {
    name: "Cross-Platform Arb",
    description: "Detect and exploit price spreads between Polymarket and Gemini",
    icon: "⚖️",
    nodes: [
      { id: "t5_1", type: "polymarket_feed", category: "data", position: { x: 0, y: 0 }, config: { market_search: "", watch_mode: "category", category: "politics", max_results: 10 } },
      { id: "t5_2", type: "gemini_markets_feed", category: "data", position: { x: 0, y: 120 }, config: { event_search: "", watch_mode: "category", category: "politics", max_results: 10 } },
      { id: "t5_3", type: "arb_detector", category: "logic", position: { x: 300, y: 60 }, config: { match_mode: "auto", min_spread: 5, net_of_fees: true } },
      { id: "t5_4", type: "cooldown_gate", category: "logic", position: { x: 550, y: 60 }, config: { period: "600", max_triggers: 2 } },
      { id: "t5_5", type: "trade_advanced", category: "action", position: { x: 800, y: 60 }, config: { platform: "auto", direction: "auto", mode: "simulate", max_position: 50 } },
    ],
    connections: [
      { id: "t5_c1", source_id: "t5_1", source_handle: "output", target_id: "t5_3", target_handle: "input_1" },
      { id: "t5_c2", source_id: "t5_2", source_handle: "output", target_id: "t5_3", target_handle: "input_2" },
      { id: "t5_c3", source_id: "t5_3", source_handle: "output", target_id: "t5_4", target_handle: "input" },
      { id: "t5_c4", source_id: "t5_4", source_handle: "output", target_id: "t5_5", target_handle: "input" },
    ],
  },
];
