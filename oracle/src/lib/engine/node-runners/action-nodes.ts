// src/lib/engine/node-runners/action-nodes.ts
import type { StrategyNode } from "@/types";
import type { River, TradeInstruction } from "../executor";
import { getStrategy, updateStrategy } from "@/lib/db/queries";

/** Map legacy/shorthand node types to canonical runner types */
const ACTION_TYPE_ALIASES: Record<string, string> = {
  trade: "trade_advanced",
  trade_polymarket: "trade_advanced",
  trade_gemini: "trade_advanced",
  alert_log: "alert_advanced",
};

export async function runActionNode(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const type = ACTION_TYPE_ALIASES[node.type] ?? node.type;

  switch (type) {
    case "trade_advanced":
      return runTradeAdvanced(node, river);
    case "alert_advanced":
      return runAlertAdvanced(node, river);
    case "strategy_link_act":
      return runStrategyLinkAct(node, river);
    default:
      console.log(`[action-nodes] Unknown action node type: ${node.type}`);
      return {};
  }
}

// ---------------------------------------------------------------------------
// Trade (Advanced)
// ---------------------------------------------------------------------------

const positionState: Record<string, {
  qty: number;
  totalCost: number;
  realizedPnl: number;
  recentTrades: { direction: string; side: string; price: number; qty: number; timestamp: string }[];
}> = {};

function runTradeAdvanced(node: StrategyNode, river: River): Record<string, any> {
  const mode = node.config.mode ?? "simulate";

  let platform = node.config.platform ?? "auto";
  if (platform === "auto") {
    // Infer platform from original node type alias, river data, or market source
    if (node.type === "trade_gemini") {
      platform = "gemini";
    } else if (node.type === "trade_polymarket") {
      platform = "polymarket";
    } else if (river.instrument_symbol || river.contract_price) {
      platform = "gemini";
    } else {
      platform = river.platform || "polymarket";
    }
  }

  let direction = node.config.direction ?? "auto";
  if (direction === "auto") {
    const d = river.ec_direction ?? river.direction ?? "bullish";
    direction = d === "bearish" ? "buy_no" : "buy_yes";
  }

  const orderType = node.config.order_type ?? "market";
  const limitPrice = node.config.limit_price ?? 0.5;
  const onlyNew = node.config.only_new ?? true;
  const autoClose = node.config.auto_close ?? false;
  const scaleIn = node.config.scale_in ?? false;
  const maxPosition = node.config.max_position ?? 100;

  if (!positionState[node.id]) {
    positionState[node.id] = { qty: 0, totalCost: 0, realizedPnl: 0, recentTrades: [] };
  }
  const state = positionState[node.id];

  const currentPrice = river.price ?? river.contract_price ?? river.yes_price ?? 0.5;
  const baseSize = river.ec_suggested_size ?? river.suggested_size ?? node.config.max_position ?? 25;
  const side = direction === "buy_no" ? "NO" : "YES";
  const currentEdge = river.ec_edge_pct ?? river.ec_edge ?? river.edge ?? 0;

  // Scale-in: increase size proportionally to edge strength when enabled
  const tradeSize = scaleIn && state.qty > 0 && currentEdge > 0
    ? baseSize * Math.min(1 + currentEdge / 10, 2.5) // Up to 2.5x on strong edge
    : baseSize;

  if (direction === "sell" || (autoClose && currentEdge < 0 && state.qty > 0)) {
    // Close position
    const closeValue = state.qty * currentPrice;
    const pnl = closeValue - state.totalCost;
    state.realizedPnl += pnl;
    state.recentTrades.push({ direction: "sell", side, price: currentPrice, qty: state.qty, timestamp: new Date().toISOString() });
    state.qty = 0;
    state.totalCost = 0;
  } else if (onlyNew && state.qty > 0 && !scaleIn) {
    // Already have a position, only_new is on, scale_in is off — skip
  } else if (state.totalCost < maxPosition) {
    const sizeToAdd = Math.min(tradeSize, maxPosition - state.totalCost);
    if (sizeToAdd > 0) {
      if (orderType === "limit" && currentPrice > limitPrice && direction !== "buy_no") {
        // Price above limit, skip
      } else {
        const qtyToAdd = sizeToAdd / currentPrice;
        state.qty += qtyToAdd;
        state.totalCost += sizeToAdd;
        state.recentTrades.push({ direction: "buy", side, price: currentPrice, qty: qtyToAdd, timestamp: new Date().toISOString() });
      }
    }
  }

  if (state.recentTrades.length > 10) state.recentTrades = state.recentTrades.slice(-10);

  const avgEntry = state.qty > 0 ? state.totalCost / state.qty : 0;
  const unrealizedPnl = state.qty > 0 ? (currentPrice - avgEntry) * state.qty : 0;
  const unrealizedPct = state.totalCost > 0 ? (unrealizedPnl / state.totalCost) * 100 : 0;

  const trade: TradeInstruction = {
    platform,
    marketId: river.market_id || river.instrument_symbol || "unknown",
    direction: side,
    amount: Math.round(tradeSize * 100) / 100,
    signal: `mode=${mode} type=${orderType} edge=${river.ec_edge_pct ?? "N/A"}%`,
    price: currentPrice,
  };

  return {
    ta_trade_confirmation: mode === "simulate" ? { ...trade, simulated: true } : trade,
    ta_position_qty: Math.round(state.qty * 100) / 100,
    ta_avg_entry: Math.round(avgEntry * 10000) / 10000,
    ta_unrealized_pnl: Math.round(unrealizedPnl * 100) / 100,
    ta_unrealized_pct: Math.round(unrealizedPct * 100) / 100,
    ta_realized_pnl: Math.round(state.realizedPnl * 100) / 100,
    ta_recent_trades: state.recentTrades.slice(-4),
  };
}

// ---------------------------------------------------------------------------
// Alert (Advanced)
// ---------------------------------------------------------------------------

const alertHistory: Record<string, { severity: string; channels: string[]; timestamp: string }[]> = {};

function runAlertAdvanced(node: StrategyNode, river: River): Record<string, any> {
  const template = node.config.message_template || "Alert: {{event_name}}";
  const severity = node.config.severity ?? "info";

  const variables: Record<string, string> = {
    event_name: river.event_title || river.headline || "Unknown",
    edge_value: river.ec_edge_pct != null ? `${river.ec_edge_pct}%` : "N/A",
    probability: river.analyst_probability != null ? `${(river.analyst_probability * 100).toFixed(0)}%` : "N/A",
    confidence: river.analyst_confidence || "N/A",
    price: (river.price ?? river.contract_price ?? river.yes_price ?? river.current_price) != null
      ? `${((river.price ?? river.contract_price ?? river.yes_price ?? river.current_price) * 100).toFixed(0)}¢`
      : "N/A",
    direction: river.ec_direction || river.analyst_direction || river.direction || "N/A",
    reasoning: river.analyst_reasoning || "",
    timestamp: new Date().toLocaleString(),
  };

  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  const channels: string[] = [];

  if (node.config.ch_app !== false) {
    channels.push("app");
    console.log(`[EDGE Alert:${severity}] ${message}`);
  }

  if (node.config.ch_discord && node.config.discord_webhook) {
    channels.push("discord");
    fetch(node.config.discord_webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `**[${severity.toUpperCase()}]** ${message}` }),
    }).catch(() => {});
  }

  if (node.config.ch_sms && node.config.phone) {
    channels.push("sms");
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_PHONE_NUMBER;
    if (twilioSid && twilioAuth && twilioFrom) {
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioAuth}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          To: node.config.phone,
          From: twilioFrom,
          Body: `[EDGE ${severity.toUpperCase()}] ${message}`,
        }).toString(),
      }).catch((err) => console.error("[EDGE SMS] Twilio error:", err));
    } else {
      console.log(`[EDGE SMS → ${node.config.phone}] (Twilio not configured) ${message}`);
    }
  }

  if (node.config.ch_email && node.config.email) {
    channels.push("email");
    console.log(`[EDGE Email → ${node.config.email}] ${message}`);
  }

  if (!alertHistory[node.id]) alertHistory[node.id] = [];
  const alertEntry = { severity, channels, timestamp: new Date().toISOString() };
  alertHistory[node.id].push(alertEntry);
  if (alertHistory[node.id].length > 20) alertHistory[node.id] = alertHistory[node.id].slice(-20);

  return {
    aa_sent: true, aa_channels: channels, aa_message: message,
    aa_timestamp: new Date().toISOString(),
    aa_recent_alerts: alertHistory[node.id].slice(-5),
  };
}

// ---------------------------------------------------------------------------
// Strategy Link (Act)
// ---------------------------------------------------------------------------

function runStrategyLinkAct(node: StrategyNode, _river: River): Record<string, any> {
  const targetId = node.config.target_strategy_id;
  if (!targetId) {
    return { sla_target_name: null, sla_target_status: null, sla_last_command: null, sla_command_time: null };
  }

  const command = node.config.command ?? "signal";

  const target = getStrategy(targetId);
  if (!target) {
    return { sla_target_name: "Not found", sla_target_status: null, sla_last_command: command, sla_command_time: new Date().toISOString() };
  }

  switch (command) {
    case "pause":
      updateStrategy(targetId, { status: "paused" });
      break;
    case "resume":
      updateStrategy(targetId, { status: "running" });
      break;
    case "adjust_sizing":
      console.log(`[Strategy Command] Adjust ${target.name} sizing to ${node.config.size_multiplier ?? 1}x`);
      break;
    case "signal":
      console.log(`[Strategy Command] Signal to ${target.name}: ${node.config.signal_value ?? "trigger"}`);
      break;
  }

  return {
    sla_target_name: target.name,
    sla_target_status: command === "pause" ? "paused" : command === "resume" ? "running" : target.status,
    sla_last_command: command,
    sla_command_time: new Date().toISOString(),
  };
}
