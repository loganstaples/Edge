// src/lib/engine/node-runners/logic-nodes.ts
import type { StrategyNode } from "@/types";
import type { River } from "../executor";

export async function runLogicNode(node: StrategyNode, river: River): Promise<Record<string, any>> {
  switch (node.type) {
    case "edge_calculator":
      return runEdgeCalculator(node, river);
    case "arb_detector":
      return runArbDetector(node, river);
    case "router":
      return runRouter(node, river);
    case "price_alert_decide":
      return runPriceAlertDecide(node, river);
    case "cooldown_gate":
      return runCooldownGate(node, river);
    case "multi_condition_gate":
      return runMultiConditionGate(node, river);
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

interface Condition {
  field: string;
  operator: string;
  value: string | number;
}

function evaluateCondition(condition: Condition, river: River): boolean {
  const fieldValue = river[condition.field];
  if (fieldValue === undefined || fieldValue === null) return false;

  const target = typeof fieldValue === "number" ? Number(condition.value) : condition.value;

  switch (condition.operator) {
    case ">": return fieldValue > target;
    case "<": return fieldValue < target;
    case ">=": return fieldValue >= target;
    case "<=": return fieldValue <= target;
    case "==": return String(fieldValue) === String(target);
    case "!=": return String(fieldValue) !== String(target);
    case "contains": return String(fieldValue).toLowerCase().includes(String(target).toLowerCase());
    case "between": {
      const [low, high] = String(condition.value).split(",").map(Number);
      return fieldValue >= low && fieldValue <= high;
    }
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Edge Calculator
// ---------------------------------------------------------------------------

function runEdgeCalculator(node: StrategyNode, river: River): Record<string, any> {
  const probability = river.analyst_probability ?? river.consensus_probability ?? null;
  const marketPrice = river.price ?? river.contract_price ?? river.yes_price ?? null;

  if (probability == null || marketPrice == null) {
    return {
      ec_raw_edge: null, ec_edge: null, ec_edge_pct: null,
      ec_source_weight: null, ec_time_decay: null, ec_liquidity_factor: null,
      ec_direction: null, ec_suggested_size: null, ec_sizing_mode: null,
      _gate_result: false, _gate_details: "Missing probability or market price input",
    };
  }

  const minEdge = node.config.min_edge ?? 5;
  const decayHalflife = parseInt(node.config.decay_halflife ?? "60", 10);
  const sizingMode = node.config.sizing_mode ?? "fixed";

  const rawEdge = probability - marketPrice;

  // Source quality weight
  const confidence = river.analyst_confidence ?? "medium";
  const depth = river._analyst_depth ?? "balanced";
  const sourceTier = river.source_tier ?? 2;
  let sourceWeight = 0.7;
  if (confidence === "high" || confidence === "very_high") sourceWeight += 0.15;
  if (confidence === "low") sourceWeight -= 0.15;
  if (depth === "thorough") sourceWeight += 0.1;
  if (depth === "fast") sourceWeight -= 0.1;
  if (sourceTier === 1) sourceWeight += 0.05;
  if (sourceTier === 3) sourceWeight -= 0.1;
  sourceWeight = Math.max(0.3, Math.min(1.0, sourceWeight));

  // Temporal decay
  const newsAgeMinutes = river.published_at
    ? Math.max(0, (Date.now() - new Date(river.published_at).getTime()) / 60000)
    : 0;
  const timeDecay = newsAgeMinutes > 0 ? Math.pow(0.5, newsAgeMinutes / decayHalflife) : 1.0;

  // Liquidity confidence
  const volume = river.volume ?? river.volume_24h ?? 0;
  const liquidity = river.liquidity ?? 0;
  const liquidityScore = Math.min(1.0, Math.max(0.2, Math.log10(Math.max(volume + liquidity, 1)) / 6));

  const finalEdge = rawEdge * sourceWeight * timeDecay * liquidityScore;
  const finalEdgePct = Math.round(finalEdge * 10000) / 100;
  const direction = finalEdge > 0 ? "bullish" : finalEdge < 0 ? "bearish" : "neutral";
  const aboveThreshold = Math.abs(finalEdgePct) >= minEdge;

  // Position sizing
  let suggestedSize = 0;
  if (aboveThreshold) {
    switch (sizingMode) {
      case "fixed":
        suggestedSize = node.config.fixed_size ?? 25;
        break;
      case "percentage": {
        const bankroll = river._bankroll ?? 1000;
        suggestedSize = bankroll * ((node.config.pct_size ?? 5) / 100);
        break;
      }
      case "kelly": {
        const odds = marketPrice > 0 ? (1 / marketPrice - 1) : 1;
        const kellyFrac = Math.max(0, finalEdge / (odds > 0 ? odds : 1));
        const bankroll = river._bankroll ?? 1000;
        suggestedSize = Math.min(bankroll * 0.25, bankroll * kellyFrac);
        break;
      }
      case "proportional": {
        const bankroll = river._bankroll ?? 1000;
        suggestedSize = bankroll * Math.min(0.25, Math.abs(finalEdge));
        break;
      }
    }
  }

  return {
    ec_raw_edge: Math.round(rawEdge * 10000) / 10000,
    ec_edge: Math.round(finalEdge * 10000) / 10000,
    ec_edge_pct: finalEdgePct,
    ec_source_weight: Math.round(sourceWeight * 100) / 100,
    ec_time_decay: Math.round(timeDecay * 100) / 100,
    ec_liquidity_factor: Math.round(liquidityScore * 100) / 100,
    ec_direction: direction,
    ec_suggested_size: Math.round(suggestedSize * 100) / 100,
    ec_sizing_mode: sizingMode,
    _gate_result: aboveThreshold,
    _gate_details: aboveThreshold
      ? `Edge ${finalEdgePct.toFixed(1)}% exceeds ${minEdge}% threshold`
      : `Edge ${finalEdgePct.toFixed(1)}% below ${minEdge}% threshold`,
  };
}

// ---------------------------------------------------------------------------
// Arbitrage Detector
// ---------------------------------------------------------------------------

function runArbDetector(node: StrategyNode, river: River): Record<string, any> {
  const minSpread = node.config.min_spread ?? 3;
  const netOfFees = node.config.net_of_fees ?? true;

  let price1 = river.polymarket_price ?? river.yes_price ?? null;
  let platform1 = "polymarket";
  let price2 = river.gemini_price ?? river.contract_price ?? null;
  let platform2 = "gemini";

  if (price1 == null && river.price != null) {
    price1 = river.price;
    platform1 = river.platform ?? "platform_1";
  }
  if (price2 == null && price1 != null && river.price != null && river.price !== price1) {
    price2 = river.price;
    platform2 = river.platform ?? "platform_2";
  }

  if (price1 == null || price2 == null) {
    return {
      arb_spread: null, arb_spread_pct: null,
      arb_buy_platform: null, arb_sell_platform: null,
      arb_buy_price: null, arb_sell_price: null,
      arb_profit_estimate: null,
      _gate_result: false, _gate_details: "Need prices from two platforms",
    };
  }

  const fee1 = netOfFees ? 0.02 : 0;
  const fee2 = netOfFees ? 0.02 : 0;

  const adj1 = price1 + fee1;
  const adj2 = price2 + fee2;

  const buyPrice = Math.min(adj1, adj2);
  const sellPrice = Math.max(price1, price2);
  const buyPlatform = adj1 < adj2 ? platform1 : platform2;
  const sellPlatform = buyPlatform === platform1 ? platform2 : platform1;

  const spread = Math.abs(price1 - price2);
  const midpoint = (price1 + price2) / 2;
  const spreadPct = midpoint > 0 ? Math.round((spread / midpoint) * 10000) / 100 : 0;

  const profitEstimate = netOfFees
    ? Math.max(0, (sellPrice - fee2) - (buyPrice)) * 100
    : spread * 100;

  const aboveThreshold = spreadPct >= minSpread;

  return {
    arb_spread: Math.round(spread * 10000) / 10000,
    arb_spread_pct: spreadPct,
    arb_buy_platform: buyPlatform,
    arb_sell_platform: sellPlatform,
    arb_buy_price: Math.round(buyPrice * 10000) / 10000,
    arb_sell_price: Math.round(sellPrice * 10000) / 10000,
    arb_profit_estimate: Math.round(profitEstimate * 100) / 100,
    _gate_result: aboveThreshold,
    _gate_details: aboveThreshold
      ? `Arb spread ${spreadPct}% exceeds ${minSpread}% threshold`
      : `Arb spread ${spreadPct}% below ${minSpread}% threshold`,
  };
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

interface Route {
  label: string;
  field: string;
  comparator: string;
  value: string;
  is_default?: boolean;
}

function runRouter(node: StrategyNode, river: River): Record<string, any> {
  const routes: Route[] = node.config.routes ?? [];

  for (let i = 0; i < routes.length; i++) {
    const route = routes[i];
    if (route.is_default) {
      return {
        _router_active_route: i, _router_label: route.label,
        _active_handle: `route_${i + 1}`, _gate_result: true,
        _gate_details: `Default route: ${route.label}`,
      };
    }

    if (!route.field) continue;

    const condition: Condition = { field: route.field, operator: route.comparator, value: route.value };
    if (evaluateCondition(condition, river)) {
      return {
        _router_active_route: i, _router_label: route.label,
        _active_handle: `route_${i + 1}`, _gate_result: true,
        _gate_details: `Matched route: ${route.label}`,
      };
    }
  }

  return { _router_active_route: null, _router_label: null, _active_handle: null, _gate_result: false, _gate_details: "No route matched" };
}

// ---------------------------------------------------------------------------
// Price Alert (Decide)
// ---------------------------------------------------------------------------

const priceAlertState: Record<string, { crossedAt: number; lastPrice: number }> = {};

function runPriceAlertDecide(node: StrategyNode, river: River): Record<string, any> {
  const currentPrice = river.price ?? river.contract_price ?? river.yes_price ?? river.current_price ?? null;
  if (currentPrice == null) {
    return { pa_triggered: false, pa_current_price: null, pa_direction: null, pa_cross_time: null, _gate_result: false, _gate_details: "No price data" };
  }

  const comparator = node.config.comparator ?? "rises_above";
  const target = node.config.target ?? 0.5;
  const holdFor = parseInt(node.config.hold_for ?? "0", 10) * 1000;
  const now = Date.now();

  const state = priceAlertState[node.id] ?? { crossedAt: 0, lastPrice: currentPrice };
  const lastPrice = state.lastPrice;
  priceAlertState[node.id] = { ...state, lastPrice: currentPrice };

  let crossed = false;
  let direction = "";

  switch (comparator) {
    case "rises_above":
      crossed = currentPrice >= target && lastPrice < target;
      direction = "up";
      break;
    case "drops_below":
      crossed = currentPrice <= target && lastPrice > target;
      direction = "down";
      break;
    case "crosses_either":
      crossed = (currentPrice >= target && lastPrice < target) || (currentPrice <= target && lastPrice > target);
      direction = currentPrice > lastPrice ? "up" : "down";
      break;
  }

  if (crossed) priceAlertState[node.id].crossedAt = now;

  let triggered = false;
  if (holdFor === 0) {
    triggered = crossed;
  } else {
    const crossedAt = priceAlertState[node.id].crossedAt;
    if (crossedAt > 0) {
      const stillCrossed = comparator === "rises_above" ? currentPrice >= target :
                          comparator === "drops_below" ? currentPrice <= target : true;
      triggered = stillCrossed && (now - crossedAt >= holdFor);
    }
  }

  return {
    pa_triggered: triggered, pa_current_price: currentPrice,
    pa_direction: direction || null,
    pa_cross_time: triggered ? new Date(now).toISOString() : null,
    _gate_result: triggered,
    _gate_details: triggered ? `Price ${direction} through ${target}` : `Watching: ${currentPrice.toFixed(4)} vs ${target}`,
  };
}

// ---------------------------------------------------------------------------
// Cooldown Gate
// ---------------------------------------------------------------------------

const cooldownGateState: Record<string, { fires: number[]; lastDirection: string | null }> = {};

function runCooldownGate(node: StrategyNode, river: River): Record<string, any> {
  const periodSec = parseInt(node.config.period ?? "300", 10);
  const periodMs = periodSec * 1000;
  const maxTriggers = node.config.max_triggers ?? 3;
  const resetOnReversal = node.config.reset_on_reversal ?? false;
  const now = Date.now();

  if (!cooldownGateState[node.id]) cooldownGateState[node.id] = { fires: [], lastDirection: null };
  const state = cooldownGateState[node.id];

  state.fires = state.fires.filter((t) => now - t < periodMs);

  const currentDirection = river.ec_direction ?? river.analyst_direction ?? river.direction ?? null;
  if (resetOnReversal && state.lastDirection && currentDirection && currentDirection !== state.lastDirection) {
    state.fires = [];
  }
  state.lastDirection = currentDirection;

  const triggersRemaining = maxTriggers - state.fires.length;
  const lastFire = state.fires.length > 0 ? state.fires[state.fires.length - 1] : 0;
  const timeSinceLastFire = lastFire > 0 ? now - lastFire : periodMs;
  const cooldownPct = lastFire > 0 ? Math.min(1, timeSinceLastFire / periodMs) : 1;

  if (triggersRemaining <= 0) {
    const nextAvailable = state.fires[0] + periodMs;
    const remaining = Math.ceil((nextAvailable - now) / 1000);
    return {
      cg_status: "blocked", cg_cooldown_pct: cooldownPct, cg_remaining: remaining, cg_triggers_remaining: 0,
      _gate_result: false, _gate_details: `Max triggers (${maxTriggers}) reached — reset in ${remaining}s`,
    };
  }

  if (lastFire > 0 && timeSinceLastFire < periodMs && state.fires.length > 0) {
    const remaining = Math.ceil((periodMs - timeSinceLastFire) / 1000);
    return {
      cg_status: "cooling", cg_cooldown_pct: cooldownPct, cg_remaining: remaining, cg_triggers_remaining: triggersRemaining,
      _gate_result: false, _gate_details: `Cooling down — ${remaining}s remaining`,
    };
  }

  state.fires.push(now);
  return {
    cg_status: "passing", cg_cooldown_pct: 1, cg_remaining: 0, cg_triggers_remaining: triggersRemaining - 1,
    _gate_result: true, _gate_details: `Passed — ${triggersRemaining - 1} triggers remaining`,
  };
}

// ---------------------------------------------------------------------------
// Multi-Condition Gate
// ---------------------------------------------------------------------------

const multiGateState: Record<string, Record<number, number>> = {};

function runMultiConditionGate(node: StrategyNode, river: River): Record<string, any> {
  const gateMode = node.config.gate_mode ?? "all";
  const inputCount = node.config.input_count ?? 2;
  const timeoutStr = node.config.timeout ?? "none";
  const timeoutMs = timeoutStr === "none" ? Infinity : parseInt(timeoutStr, 10) * 1000;
  const now = Date.now();

  if (!multiGateState[node.id]) multiGateState[node.id] = {};

  const triggerFields = [
    "_gate_result", "ec_edge", "analyst_probability",
    "consensus_probability", "pa_triggered", "scanner_sentiment_score",
  ];

  const hasSignal = triggerFields.some((f) => {
    const val = river[f];
    return val === true || (typeof val === "number" && val !== 0);
  });

  const inputStates: boolean[] = [];
  for (let i = 0; i < inputCount; i++) {
    const lastTrigger = multiGateState[node.id][i] ?? 0;
    const isActive = lastTrigger > 0 && (now - lastTrigger < timeoutMs);

    if (hasSignal && !isActive) {
      const firstEmpty = Object.keys(multiGateState[node.id]).length;
      if (firstEmpty === i) {
        multiGateState[node.id][i] = now;
        inputStates.push(true);
        continue;
      }
    }

    inputStates.push(isActive);
  }

  if (hasSignal && !inputStates.some((_, i) => multiGateState[node.id][i] === now)) {
    for (let i = 0; i < inputCount; i++) {
      const lastTrigger = multiGateState[node.id][i] ?? 0;
      if (now - lastTrigger >= timeoutMs || lastTrigger === 0) {
        multiGateState[node.id][i] = now;
        inputStates[i] = true;
        break;
      }
    }
  }

  const activeCount = inputStates.filter(Boolean).length;
  let satisfied = false;

  switch (gateMode) {
    case "all": satisfied = activeCount === inputCount; break;
    case "any": satisfied = activeCount >= 1; break;
    case "majority": satisfied = activeCount > inputCount / 2; break;
  }

  if (satisfied && gateMode === "all") multiGateState[node.id] = {};

  return {
    mcg_satisfied: satisfied, mcg_input_states: inputStates, mcg_mode: gateMode,
    _gate_result: satisfied,
    _gate_details: satisfied
      ? `Gate satisfied: ${activeCount}/${inputCount} inputs active (${gateMode})`
      : `Waiting: ${activeCount}/${inputCount} inputs active (${gateMode})`,
  };
}
