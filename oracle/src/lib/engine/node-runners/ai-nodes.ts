// src/lib/engine/node-runners/ai-nodes.ts
import type { StrategyNode } from "@/types";
import type { River } from "../executor";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function runAINode(node: StrategyNode, river: River): Promise<Record<string, any>> {
  switch (node.type) {
    case "ai_analyst":
      return await runAIAnalyst(node, river);
    case "sentiment_scanner":
      return await runSentimentScanner(node, river);
    case "consensus":
      return await runConsensus(node, river);
    case "history_tracker":
      return await runHistoryTracker(node, river);
    case "formula":
      return await runFormula(node, river);
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// AI Analyst
// ---------------------------------------------------------------------------

const DEPTH_CONFIG: Record<string, { maxTokens: number; model: string }> = {
  fast: { maxTokens: 512, model: "claude-haiku-4-5-20251001" },
  balanced: { maxTokens: 1024, model: "claude-haiku-4-5-20251001" },
  thorough: { maxTokens: 2048, model: "claude-haiku-4-5-20251001" },
};

async function runAIAnalyst(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const instruction = node.config.instruction || "";
  if (!instruction) return { analyst_probability: null, analyst_confidence: null, analyst_direction: null, analyst_reasoning: "No instruction provided" };

  const structured = node.config.structured ?? true;
  const depth = node.config.depth ?? "balanced";
  const depthCfg = DEPTH_CONFIG[depth] ?? DEPTH_CONFIG.balanced;

  const contextParts: string[] = [];
  for (const [key, value] of Object.entries(river)) {
    if (key.startsWith("_") || value == null) continue;
    contextParts.push(`${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  }
  const contextStr = contextParts.join("\n");

  const systemPrompt = structured
    ? `You are an expert analyst for prediction markets. Follow the user's instruction and analyze the provided data.

Return ONLY valid JSON:
{
  "probability": <0.01-0.99>,
  "confidence": "low"|"medium"|"high"|"very_high",
  "direction": "bullish"|"bearish"|"neutral",
  "reasoning": "1-2 paragraph analysis"
}`
    : `You are an expert analyst for prediction markets. Follow the user's instruction and analyze the provided data. Provide your analysis as clear, concise text.`;

  try {
    const message = await client.messages.create({
      model: depthCfg.model,
      max_tokens: depthCfg.maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: `INSTRUCTION: ${instruction}\n\nDATA:\n${contextStr}` }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text : "";

    if (!structured) {
      return { analyst_probability: null, analyst_confidence: null, analyst_direction: null, analyst_reasoning: text, analyst_raw_text: text };
    }

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return {
      analyst_probability: Math.max(0.01, Math.min(0.99, parsed.probability ?? 0.5)),
      analyst_confidence: parsed.confidence ?? "medium",
      analyst_direction: parsed.direction ?? "neutral",
      analyst_reasoning: parsed.reasoning ?? "",
      analyst_raw_text: text,
    };
  } catch {
    return { analyst_probability: 0.5, analyst_confidence: "low", analyst_direction: "neutral", analyst_reasoning: "Analysis failed" };
  }
}

// ---------------------------------------------------------------------------
// Sentiment Scanner
// ---------------------------------------------------------------------------

/** Rolling buffer for aggregation windows */
const sentimentBuffer: Record<string, { score: number; magnitude: number; timestamp: number }[]> = {};

async function runSentimentScanner(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const domain = node.config.domain ?? "general";
  const aggregation = node.config.aggregation ?? "per_item";

  const text = river.headline || river.tweet_text || river.event_title || river.description || "";
  if (!text) return { scanner_sentiment_score: 0, scanner_magnitude: 0, scanner_volume_count: 0 };

  const domainContext: Record<string, string> = {
    general: "general news and events",
    crypto: "cryptocurrency markets — phrases like 'to the moon', 'HODL', 'pump' are very bullish; 'rug pull', 'dump', 'bearish' are very negative",
    political: "political events and policy — focus on policy impact rather than partisan language",
    financial: "financial markets and economics — focus on monetary policy, earnings, and market impact",
    sports: "sports events and betting — focus on team performance, injuries, and momentum",
  };

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 128,
      system: `Score the sentiment of this text in the context of ${domainContext[domain] ?? domainContext.general}.
Return ONLY JSON: {"score": <-100 to 100>, "magnitude": <0 to 100>}`,
      messages: [{ role: "user", content: text }],
    });

    const responseText = message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const score = Math.max(-100, Math.min(100, parsed.score ?? 0));
    const magnitude = Math.max(0, Math.min(100, parsed.magnitude ?? 0));

    if (aggregation === "per_item") {
      return { scanner_sentiment_score: score, scanner_magnitude: magnitude, scanner_volume_count: 1 };
    }

    // Aggregated mode — add to rolling buffer
    if (!sentimentBuffer[node.id]) sentimentBuffer[node.id] = [];
    sentimentBuffer[node.id].push({ score, magnitude, timestamp: Date.now() });

    const windowMs: Record<string, number> = { "5m": 300_000, "15m": 900_000, "1h": 3_600_000 };
    const windowCutoff = Date.now() - (windowMs[aggregation] ?? 300_000);
    sentimentBuffer[node.id] = sentimentBuffer[node.id].filter((e) => e.timestamp >= windowCutoff);

    const entries = sentimentBuffer[node.id];
    const avgScore = entries.reduce((s, e) => s + e.score, 0) / entries.length;
    const avgMag = entries.reduce((s, e) => s + e.magnitude, 0) / entries.length;

    return {
      scanner_sentiment_score: Math.round(avgScore),
      scanner_magnitude: Math.round(avgMag),
      scanner_volume_count: entries.length,
    };
  } catch {
    return { scanner_sentiment_score: 0, scanner_magnitude: 0, scanner_volume_count: 0 };
  }
}

// ---------------------------------------------------------------------------
// Consensus
// ---------------------------------------------------------------------------

async function runConsensus(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const mode = node.config.consensus_mode ?? "weighted_avg";
  const inputCount = node.config.input_count ?? 2;
  const weights: number[] = node.config.weights ?? Array(inputCount).fill(Math.round(100 / inputCount));

  const probFields = [
    "analyst_probability", "consensus_probability",
    "scanner_sentiment_score", "calibrated_probability",
  ];

  const inputProbs: number[] = [];
  const inputDirections: string[] = [];

  for (const key of Object.keys(river)) {
    for (const pf of probFields) {
      if (key === pf || key.endsWith(`_${pf}`)) {
        const val = river[key];
        if (typeof val === "number" && val >= 0 && val <= 1) {
          inputProbs.push(val);
        } else if (typeof val === "number" && val >= -100 && val <= 100) {
          inputProbs.push((val + 100) / 200);
        }
      }
    }
    if (key.includes("direction") && typeof river[key] === "string") {
      inputDirections.push(river[key]);
    }
  }

  if (inputProbs.length === 0) {
    return { consensus_probability: null, consensus_confidence: 0, consensus_direction: "neutral", consensus_disagreement: false };
  }

  const effectiveWeights = inputProbs.map((_, i) => weights[i] ?? (100 / inputProbs.length));
  const weightSum = effectiveWeights.reduce((s, w) => s + w, 0);
  const normalizedWeights = effectiveWeights.map((w) => w / weightSum);

  let probability: number;
  let direction: string;

  if (mode === "majority") {
    const bullishCount = inputDirections.filter((d) => d === "bullish").length;
    const bearishCount = inputDirections.filter((d) => d === "bearish").length;
    const majority = Math.ceil(inputProbs.length / 2);

    if (bullishCount >= majority) {
      direction = "bullish";
      const bullishProbs = inputProbs.filter((_, i) => inputDirections[i] === "bullish");
      probability = bullishProbs.reduce((s, p) => s + p, 0) / bullishProbs.length;
    } else if (bearishCount >= majority) {
      direction = "bearish";
      const bearishProbs = inputProbs.filter((_, i) => inputDirections[i] === "bearish");
      probability = bearishProbs.reduce((s, p) => s + p, 0) / bearishProbs.length;
    } else {
      direction = "neutral";
      probability = 0.5;
    }
  } else {
    probability = inputProbs.reduce((s, p, i) => s + p * normalizedWeights[i], 0);
    direction = probability > 0.55 ? "bullish" : probability < 0.45 ? "bearish" : "neutral";
  }

  const mean = inputProbs.reduce((s, p) => s + p, 0) / inputProbs.length;
  const variance = inputProbs.reduce((s, p) => s + (p - mean) ** 2, 0) / inputProbs.length;
  const stdev = Math.sqrt(variance);
  const confidence = Math.max(0, Math.min(1, 1 - stdev / 0.5));

  const hasUp = inputProbs.some((p) => p > 0.55);
  const hasDown = inputProbs.some((p) => p < 0.45);
  const disagreement = hasUp && hasDown;

  return {
    consensus_probability: Math.round(probability * 1000) / 1000,
    consensus_confidence: Math.round(confidence * 1000) / 1000,
    consensus_direction: direction,
    consensus_disagreement: disagreement,
    _input_probabilities: inputProbs,
  };
}

// ---------------------------------------------------------------------------
// History Tracker
// ---------------------------------------------------------------------------

const historyBuffers: Record<string, { value: number; timestamp: number }[]> = {};

async function runHistoryTracker(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const trackField = node.config.track_field ?? "analyst_probability";
  const maxDepth = node.config.depth ?? 25;
  const timeWindow = node.config.time_window ?? "1h";

  const currentValue = river[trackField];
  if (currentValue == null || typeof currentValue !== "number") {
    return {
      history_current: null, history_values: [], history_trend: "flat",
      history_avg: null, history_min: null, history_max: null,
      history_streak: 0, history_rate_of_change: 0,
    };
  }

  if (!historyBuffers[node.id]) historyBuffers[node.id] = [];
  historyBuffers[node.id].push({ value: currentValue, timestamp: Date.now() });

  const windowMs: Record<string, number> = {
    "5m": 300_000, "15m": 900_000, "1h": 3_600_000,
    "4h": 14_400_000, "24h": 86_400_000, "7d": 604_800_000,
  };
  const cutoff = Date.now() - (windowMs[timeWindow] ?? 3_600_000);
  historyBuffers[node.id] = historyBuffers[node.id].filter((e) => e.timestamp >= cutoff);

  if (historyBuffers[node.id].length > maxDepth) {
    historyBuffers[node.id] = historyBuffers[node.id].slice(-maxDepth);
  }

  const entries = historyBuffers[node.id];
  const values = entries.map((e) => e.value);

  if (values.length === 0) {
    return {
      history_current: currentValue, history_values: [currentValue], history_trend: "flat",
      history_avg: currentValue, history_min: currentValue, history_max: currentValue,
      history_streak: 1, history_rate_of_change: 0,
    };
  }

  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);

  const n = values.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i; sumY += values[i]; sumXY += i * values[i]; sumXX += i * i;
  }
  const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;
  const trend = slope > 0.001 ? "rising" : slope < -0.001 ? "falling" : "flat";

  let streak = 1;
  if (values.length >= 2) {
    const lastDir = values[values.length - 1] >= values[values.length - 2] ? "up" : "down";
    for (let i = values.length - 2; i > 0; i--) {
      const dir = values[i] >= values[i - 1] ? "up" : "down";
      if (dir === lastDir) streak++; else break;
    }
  }

  const rateOfChange = values.length >= 2 ? (values[values.length - 1] - values[0]) / (values.length - 1) : 0;

  return {
    history_current: currentValue,
    history_values: values,
    history_trend: trend,
    history_avg: Math.round(avg * 10000) / 10000,
    history_min: min,
    history_max: max,
    history_streak: streak,
    history_rate_of_change: Math.round(rateOfChange * 10000) / 10000,
  };
}

// ---------------------------------------------------------------------------
// Formula
// ---------------------------------------------------------------------------

async function runFormula(node: StrategyNode, river: River): Promise<Record<string, any>> {
  const formulaStr = (node.config.formula ?? "").trim();
  if (!formulaStr) return { formula_result: null, formula_error: "No formula provided" };

  try {
    const result = evaluateFormula(formulaStr, river);
    return { formula_result: result, formula_error: null };
  } catch (err: any) {
    return { formula_result: null, formula_error: err.message || "Evaluation error" };
  }
}

function evaluateFormula(formula: string, river: River): number {
  let expr = formula;

  const ifMatch = expr.match(/if\s+(.+?)\s+then\s+(.+?)\s+else\s+(.+)/i);
  if (ifMatch) {
    const condition = evalFormulaCondition(ifMatch[1], river);
    expr = condition ? ifMatch[2] : ifMatch[3];
  }

  const varNames = Object.keys(river)
    .filter((k) => typeof river[k] === "number")
    .sort((a, b) => b.length - a.length);

  for (const name of varNames) {
    expr = expr.replace(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), String(river[name]));
  }

  expr = expr.replace(/min\(([^)]+)\)/gi, (_, args) => String(Math.min(...args.split(",").map((a: string) => parseFloat(a.trim())))));
  expr = expr.replace(/max\(([^)]+)\)/gi, (_, args) => String(Math.max(...args.split(",").map((a: string) => parseFloat(a.trim())))));
  expr = expr.replace(/avg\(([^)]+)\)/gi, (_, args) => {
    const nums = args.split(",").map((a: string) => parseFloat(a.trim()));
    return String(nums.reduce((s: number, n: number) => s + n, 0) / nums.length);
  });
  expr = expr.replace(/abs\(([^)]+)\)/gi, (_, arg) => String(Math.abs(parseFloat(arg.trim()))));
  expr = expr.replace(/round\(([^)]+)\)/gi, (_, arg) => String(Math.round(parseFloat(arg.trim()))));

  if (!/^[\d\s+\-*/().]+$/.test(expr)) {
    throw new Error(`Invalid characters in expression: ${expr}`);
  }

  const fn = new Function(`"use strict"; return (${expr});`);
  const result = fn();

  if (typeof result !== "number" || !isFinite(result)) {
    throw new Error("Formula did not produce a finite number");
  }

  return result;
}

function evalFormulaCondition(condStr: string, river: River): boolean {
  const operators = [">=", "<=", "!=", ">", "<", "=="];
  for (const op of operators) {
    const parts = condStr.split(op);
    if (parts.length === 2) {
      const left = resolveValue(parts[0].trim(), river);
      const right = resolveValue(parts[1].trim(), river);
      switch (op) {
        case ">": return left > right;
        case "<": return left < right;
        case ">=": return left >= right;
        case "<=": return left <= right;
        case "==": return left === right;
        case "!=": return left !== right;
      }
    }
  }
  return resolveValue(condStr.trim(), river) > 0;
}

function resolveValue(token: string, river: River): number {
  const num = parseFloat(token);
  if (!isNaN(num)) return num;
  return typeof river[token] === "number" ? river[token] : 0;
}
