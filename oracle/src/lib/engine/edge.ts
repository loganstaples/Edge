// ═══════════════════════════════════════════════════════════════════════════
// MULTI-FACTOR CONFIDENCE SCORING & BAYESIAN EDGE FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════
//
// A 9-stage scoring pipeline that transforms raw AI probability estimates
// and market data into calibrated, risk-adjusted trading signals for
// prediction markets.
//
// ┌─────────────────────────────────────────────────────────────────────┐
// │  PIPELINE OVERVIEW                                                  │
// │                                                                     │
// │  Stage 1 — Beta Distribution Modeling                               │
// │    Model AI probability p̂ as Beta(α,β) to capture epistemic        │
// │    uncertainty. κ = α + β encodes confidence; higher κ means the    │
// │    AI is more certain of its point estimate.                        │
// │      α = p̂ × κ,   β = (1 − p̂) × κ                                │
// │      κ ∈ {8, 20, 50} for {low, medium, high} confidence            │
// │      Var[X] = αβ / ((α+β)² (α+β+1))                               │
// │                                                                     │
// │  Stage 2 — Platt Scaling Calibration                                │
// │    Correct systematic AI overconfidence via a learned sigmoid:       │
// │      p_cal = σ(a × logit(p̂) + b)                                  │
// │    where a < 1 compresses extremes and b corrects bias.             │
// │    This is superior to linear shrinkage because the bias is         │
// │    non-linear — AI is more overconfident at the extremes.           │
// │                                                                     │
// │  Stage 3 — Orderbook Microstructure                                 │
// │    If orderbook data is available, extract:                         │
// │    - Effective spread & VWAP slippage (execution cost)              │
// │    - Depth imbalance (directional pressure signal)                  │
// │    - Market efficiency score (consensus strength)                   │
// │                                                                     │
// │  Stage 4 — Information-Theoretic Divergence                         │
// │    Quantify AI-vs-market disagreement:                              │
// │    - KL(AI ‖ Market) — bits of "surprise" if market is correct      │
// │    - Shannon entropy — AI's own uncertainty                         │
// │    - Information ratio — edge per unit of uncertainty               │
// │                                                                     │
// │  Stage 5 — Multi-Factor Confidence Aggregation                      │
// │    Weighted composite of 9 orthogonal signals, each ∈ [0,1]:       │
// │    aiConfidence, sourceCorroboration, reasoningDepth,                │
// │    liquidityQuality, temporalFreshness, extremityPenalty,           │
// │    sentimentAlignment, orderBookConfirmation, marketEfficiency       │
// │                                                                     │
// │  Stage 6 — Effective Edge                                           │
// │    Adjust calibrated edge for confidence, slippage, and market      │
// │    efficiency:                                                      │
// │      E_eff = E_cal × C × (1 − slippage) × (1 − η×efficiency)      │
// │    where η controls how much to discount edge in efficient markets. │
// │                                                                     │
// │  Stage 7 — Kelly Criterion with Drawdown Constraint                 │
// │    Optimal bet fraction for binary prediction market payoff:        │
// │      f* = (b×p − q) / b                                            │
// │      f_safe = min(f* × ½ × confidence, max_kelly, drawdown_cap)    │
// │                                                                     │
// │  Stage 8 — Expected Value Framework                                 │
// │    Decision-theoretic analysis of the trade:                        │
// │    - E[gain], E[loss], E[value], risk/reward ratio                  │
// │    - EVPI — expected value of resolving remaining uncertainty       │
// │                                                                     │
// │  Stage 9 — Signal Classification                                    │
// │    Map continuous effective edge + confidence to actionable signal.  │
// └─────────────────────────────────────────────────────────────────────┘

import type {
  EdgeResult,
  SignalStrength,
  Platform,
  Confidence,
  ConfidenceFactors,
} from "@/types";
import type { OrderBookMetrics } from "./orderbook";

// ═══════════════════════════════════════════════════════════════════════════
// HYPERPARAMETERS
// ═══════════════════════════════════════════════════════════════════════════

/** Beta distribution concentration κ per confidence level.
 *  Higher κ = tighter distribution around the point estimate.
 *  These values are chosen so that:
 *    low  → κ=8  → std ≈ 0.16  (very uncertain)
 *    med  → κ=20 → std ≈ 0.10  (moderate)
 *    high → κ=50 → std ≈ 0.06  (fairly certain)
 */
const BETA_CONCENTRATION: Record<Confidence, number> = {
  low: 8,
  medium: 20,
  high: 50,
};

/** Platt scaling parameters.
 *  a = slope (< 1 compresses extremes), b = intercept (bias shift).
 *  Calibrated against known LLM overconfidence patterns:
 *    - a = 0.82: aggressive compression (LLMs push too close to 0/1)
 *    - b = 0.0:  no systematic directional bias assumed */
const PLATT_A = 0.82;
const PLATT_B = 0.0;

/** Confidence factor weights — must sum to 1.0 */
const FACTOR_WEIGHTS = {
  aiConfidence:          0.20,
  sourceCorroboration:   0.10,
  reasoningDepth:        0.08,
  liquidityQuality:      0.15,
  temporalFreshness:     0.10,
  extremityPenalty:      0.07,
  sentimentAlignment:    0.10,
  orderBookConfirmation: 0.10,
  marketEfficiencyAdj:   0.10,
} as const;

/** Map AI string confidence to numeric base score */
const CONFIDENCE_NUMERIC: Record<Confidence, number> = {
  low: 0.30,
  medium: 0.60,
  high: 0.90,
};

/** Market efficiency discount factor η.
 *  Effective edge is multiplied by (1 − η × marketEfficiency).
 *  At η=0.3 and marketEfficiency=1.0, edge is discounted 30%. */
const EFFICIENCY_DISCOUNT = 0.3;

/** Half-Kelly multiplier */
const KELLY_MULT = 0.5;
/** Maximum Kelly fraction cap */
const MAX_KELLY = 0.15;
/** Maximum fraction of bankroll risked per trade (drawdown constraint) */
const MAX_DRAWDOWN_FRACTION = 0.05;
/** Default bankroll */
const DEFAULT_BANKROLL = 1000;

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

export interface EdgeContext {
  confidence: Confidence;
  /** Number of corroborating news sources */
  sourceCount?: number;
  /** Number of key reasoning factors identified by AI */
  keyFactorCount?: number;
  /** Bid-ask spread (absolute, e.g. 0.02 = 2¢) */
  spread?: number;
  /** Market volume in USD */
  volume?: number;
  /** Age of the triggering news article in hours */
  newsAgeHours?: number;
  /** Sentiment score ∈ [-1, 1] */
  sentimentScore?: number;
  /** Full orderbook metrics (from orderbook.ts analyzeOrderBook) */
  orderBook?: OrderBookMetrics | null;
  /** Bankroll for Kelly sizing */
  bankroll?: number;
}

/**
 * Compute the full multi-stage edge analysis.
 *
 * Backward-compatible: the first four parameters match the original
 * signature so that all existing call sites continue to work.
 */
export function computeEdge(
  aiProbability: number,
  marketProbability: number,
  confidence: Confidence,
  platform: Platform,
  ctx?: EdgeContext,
): EdgeResult {
  const context: EdgeContext = { confidence, ...ctx };
  const clampedAI = clamp(aiProbability, 0.005, 0.995);
  const clampedMarket = clamp(marketProbability, 0.005, 0.995);

  // ── Stage 1: Beta distribution ──────────────────────────────────────
  const kappa = BETA_CONCENTRATION[confidence];
  const alpha = clampedAI * kappa;
  const beta = (1 - clampedAI) * kappa;
  const aiVariance = betaVariance(alpha, beta);
  const aiStdDev = Math.sqrt(aiVariance);

  // ── Stage 2: Platt scaling calibration ──────────────────────────────
  const calibratedAI = plattScale(clampedAI);

  // ── Stage 3: Orderbook microstructure ───────────────────────────────
  const ob = context.orderBook ?? null;
  const estimatedSlippage = ob
    ? ob.slippagePct
    : estimateSlippageFromSpread(context.spread ?? 0.02);
  const marketEfficiency = ob
    ? ob.marketEfficiency
    : estimateEfficiencyFromBasics(context.spread ?? 0.02, context.volume ?? 0);

  // ── Stage 4: Information-theoretic divergence ───────────────────────
  const klDiv = klDivergenceBernoulli(calibratedAI, clampedMarket);
  const entropy = shannonEntropyBernoulli(calibratedAI);
  const informationRatio = entropy > 0.001
    ? Math.abs(calibratedAI - clampedMarket) / aiStdDev
    : 0;

  // ── Stage 5: Multi-factor confidence ────────────────────────────────
  const factors = computeConfidenceFactors(
    context, calibratedAI, clampedMarket, ob,
  );
  const compositeConfidence = weightedComposite(factors);

  // ── Stage 6: Effective edge ─────────────────────────────────────────
  const calibratedEdge = calibratedAI - clampedMarket;
  const bayesianEdge = logOddsEdge(calibratedAI, clampedMarket);

  // Discount for: confidence, slippage cost, and market efficiency
  const slippageMultiplier = Math.max(0, 1 - estimatedSlippage);
  const efficiencyMultiplier = 1 - EFFICIENCY_DISCOUNT * marketEfficiency;
  const effectiveEdge =
    calibratedEdge * compositeConfidence * slippageMultiplier * efficiencyMultiplier;

  // ── Stage 7: Kelly criterion ────────────────────────────────────────
  const kellyFraction = computeKelly(
    calibratedAI, clampedMarket, compositeConfidence,
  );
  const bankroll = context.bankroll ?? DEFAULT_BANKROLL;
  const suggestedSize = round4(kellyFraction * bankroll);

  // ── Stage 8: Expected value framework ──────────────────────────────
  const ev = computeExpectedValue(
    calibratedAI, clampedMarket, suggestedSize,
  );

  // ── Stage 9: Signal classification ──────────────────────────────────
  const signalStrength = classifySignal(
    Math.abs(effectiveEdge), compositeConfidence, informationRatio,
  );

  return {
    // Core edge metrics
    edge: round4(calibratedEdge),
    bayesianEdge: round4(bayesianEdge),
    effectiveEdge: round4(effectiveEdge),
    calibratedProbability: round4(calibratedAI),
    aiProbability: round4(clampedAI),
    marketProbability: clampedMarket,
    platform,

    // Probabilistic model
    aiUncertainty: round4(aiStdDev),
    betaAlpha: round4(alpha),
    betaBeta: round4(beta),

    // Information theory
    klDivergence: round4(klDiv),
    shannonEntropy: round4(entropy),
    informationRatio: round4(informationRatio),

    // Confidence
    compositeConfidence: round4(compositeConfidence),
    confidenceFactors: factors,

    // Market microstructure
    liquidityScore: round4(factors.liquidityQuality),
    estimatedSlippage: round4(estimatedSlippage),
    marketEfficiency: round4(marketEfficiency),
    orderBookImbalance: ob ? round4(ob.depthImbalance) : 0,

    // Position sizing
    kellyFraction: round4(kellyFraction),
    suggestedSize,

    // Expected value
    expectedValue: round4(ev.expectedValue),
    expectedGain: round4(ev.expectedGain),
    expectedLoss: round4(ev.expectedLoss),
    riskRewardRatio: round4(ev.riskRewardRatio),
    evpi: round4(ev.evpi),

    // Signal
    signalStrength,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 2 — PLATT SCALING CALIBRATION
// ═══════════════════════════════════════════════════════════════════════════
//
// Standard linear shrinkage (p_cal = λp + (1-λ)×0.5) compresses
// uniformly. But AI overconfidence is non-linear — it's worse at the
// extremes. Platt scaling applies a sigmoid in log-odds space:
//
//   p_cal = σ(a × logit(p) + b)
//
// With a = 0.82 (< 1):
//   - p = 0.50 → logit = 0    → cal = σ(0)    = 0.50  (unchanged)
//   - p = 0.90 → logit = 2.20 → cal = σ(1.80) = 0.858 (pulled inward)
//   - p = 0.95 → logit = 2.94 → cal = σ(2.41) = 0.918 (stronger pull)
//   - p = 0.10 → logit = -2.2 → cal = σ(-1.8) = 0.142 (symmetric pull)
//
// This matches empirical observations: AI models are ~OK near 50%
// but systematically overshoot near the rails.

function plattScale(p: number): number {
  const l = logit(clamp(p, 0.005, 0.995));
  return invLogit(PLATT_A * l + PLATT_B);
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 4 — INFORMATION-THEORETIC METRICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * KL divergence between two Bernoulli distributions.
 *
 *   KL(P ‖ Q) = p × ln(p/q) + (1−p) × ln((1−p)/(1−q))
 *
 * Measures the information lost when using Q (market) to approximate
 * P (AI). A high KL means the AI strongly disagrees with the market.
 * Unlike raw edge, KL is scale-aware: a 5% disagreement at 50% is
 * different from 5% at 95%.
 *
 * Properties:
 *   - KL ≥ 0, with KL = 0 iff p = q
 *   - Asymmetric: KL(P‖Q) ≠ KL(Q‖P) in general
 *   - Units: nats (using ln; divide by ln(2) for bits)
 */
function klDivergenceBernoulli(p: number, q: number): number {
  const cp = clamp(p, 0.001, 0.999);
  const cq = clamp(q, 0.001, 0.999);
  return (
    cp * Math.log(cp / cq) +
    (1 - cp) * Math.log((1 - cp) / (1 - cq))
  );
}

/**
 * Shannon entropy of a Bernoulli distribution.
 *
 *   H(p) = −p × ln(p) − (1−p) × ln(1−p)
 *
 * Maximum at p = 0.5 (H = ln(2) ≈ 0.693 nats).
 * Low entropy → the AI is very confident in its prediction (for or against).
 */
function shannonEntropyBernoulli(p: number): number {
  const cp = clamp(p, 0.001, 0.999);
  return -(cp * Math.log(cp) + (1 - cp) * Math.log(1 - cp));
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 5 — MULTI-FACTOR CONFIDENCE
// ═══════════════════════════════════════════════════════════════════════════

function computeConfidenceFactors(
  ctx: EdgeContext,
  calAI: number,
  market: number,
  ob: OrderBookMetrics | null,
): ConfidenceFactors {
  // 1. AI self-assessed confidence
  const aiConfidence = CONFIDENCE_NUMERIC[ctx.confidence] ?? 0.5;

  // 2. Source corroboration — sigmoid saturating at ~5 sources
  const nSources = ctx.sourceCount ?? 1;
  const sourceCorroboration = sigmoid(nSources, 3, 1.2);

  // 3. Reasoning depth — more factors = better reasoned, cap at 7
  const nFactors = ctx.keyFactorCount ?? 2;
  const reasoningDepth = Math.min(1, nFactors / 7);

  // 4. Liquidity quality — from orderbook or spread/volume estimates
  const liquidityQuality = ob
    ? computeLiquidityFromOB(ob)
    : computeLiquidityFromBasics(ctx.spread ?? 0.05, ctx.volume ?? 0);

  // 5. Temporal freshness — exponential decay, half-life = 4 hours
  //    f(t) = exp(−ln(2) × t / 4)
  //    At t=0: 1.0, t=4h: 0.5, t=8h: 0.25, t=24h: 0.015
  const ageH = ctx.newsAgeHours ?? 0;
  const temporalFreshness = Math.exp(-0.1733 * ageH);

  // 6. Extremity penalty — penalize AI probs near 0 or 1
  //    4×p×(1−p) peaks at 0.5 (=1.0) and drops to 0 at extremes.
  //    This guards against the well-known AI tendency to overcommit
  //    to extreme probabilities.
  const extremityPenalty = 4 * calAI * (1 - calAI);

  // 7. Sentiment–edge alignment
  const sentimentAlignment = computeSentimentAlignment(
    ctx.sentimentScore, calAI, market,
  );

  // 8. Orderbook confirmation — does the book's directional pressure
  //    agree with the AI's edge direction?
  const orderBookConfirmation = computeOBConfirmation(ob, calAI, market);

  // 9. Market efficiency adjustment — more efficient markets get a
  //    lower confidence (it's harder to be right against them).
  //    Inverted: high efficiency → low score → reduces composite.
  const efficiency = ob
    ? ob.marketEfficiency
    : estimateEfficiencyFromBasics(ctx.spread ?? 0.02, ctx.volume ?? 0);
  const marketEfficiencyAdj = 1 - efficiency;

  return {
    aiConfidence: round4(aiConfidence),
    sourceCorroboration: round4(sourceCorroboration),
    reasoningDepth: round4(reasoningDepth),
    liquidityQuality: round4(liquidityQuality),
    temporalFreshness: round4(temporalFreshness),
    extremityPenalty: round4(extremityPenalty),
    sentimentAlignment: round4(sentimentAlignment),
    orderBookConfirmation: round4(orderBookConfirmation),
    marketEfficiencyAdj: round4(marketEfficiencyAdj),
  };
}

function weightedComposite(f: ConfidenceFactors): number {
  return (
    FACTOR_WEIGHTS.aiConfidence          * f.aiConfidence +
    FACTOR_WEIGHTS.sourceCorroboration   * f.sourceCorroboration +
    FACTOR_WEIGHTS.reasoningDepth        * f.reasoningDepth +
    FACTOR_WEIGHTS.liquidityQuality      * f.liquidityQuality +
    FACTOR_WEIGHTS.temporalFreshness     * f.temporalFreshness +
    FACTOR_WEIGHTS.extremityPenalty      * f.extremityPenalty +
    FACTOR_WEIGHTS.sentimentAlignment    * f.sentimentAlignment +
    FACTOR_WEIGHTS.orderBookConfirmation * f.orderBookConfirmation +
    FACTOR_WEIGHTS.marketEfficiencyAdj   * f.marketEfficiencyAdj
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 7 — KELLY CRITERION
// ═══════════════════════════════════════════════════════════════════════════
//
// In a binary prediction market, buying a YES contract at price m
// pays $1 if the event occurs, $0 otherwise. The payout odds are:
//   b = (1 − m) / m
//
// Kelly optimal fraction:
//   f* = (b × p − q) / b   where p = true prob, q = 1 − p
//
// We apply three safety modifications:
//   1. Half-Kelly: f × 0.5 (classic risk reduction)
//   2. Confidence scaling: f × compositeConfidence
//   3. Drawdown cap: min(f, MAX_DRAWDOWN_FRACTION)

function computeKelly(
  calAI: number,
  market: number,
  confidence: number,
): number {
  const p = clamp(calAI, 0.01, 0.99);
  const q = 1 - p;
  const mp = clamp(market, 0.01, 0.99);

  let fraction: number;
  if (p > mp) {
    // Bet YES: odds b = (1 − mp) / mp
    const b = (1 - mp) / mp;
    fraction = (b * p - q) / b;
  } else {
    // Bet NO: odds b = mp / (1 − mp), true prob of NO = q
    const b = mp / (1 - mp);
    fraction = (b * q - p) / b;
  }

  if (fraction <= 0) return 0;

  return Math.min(
    fraction * KELLY_MULT * confidence,
    MAX_KELLY,
    MAX_DRAWDOWN_FRACTION,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 8 — EXPECTED VALUE FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════
//
// For a YES trade at market price m with AI probability p and size S:
//   E[gain] = p × (1 − m) × S      (probability of win × profit per contract)
//   E[loss] = (1 − p) × m × S      (probability of loss × loss per contract)
//   E[value] = E[gain] − E[loss]
//   Risk/Reward = E[gain] / E[loss]
//
// EVPI (Expected Value of Perfect Information):
//   If we knew the true outcome, we'd always bet correctly:
//     E[V|perfect] = p × (1 − m) × S     (when event happens, we buy at m)
//                  + (1 − p) × m × S      (when it doesn't, we sell at m)
//   But we might currently make the wrong bet, so:
//     EVPI = E[V|perfect] − max(E[V|bet], 0)
//   This quantifies the value of getting more information before trading.

interface ExpectedValue {
  expectedGain: number;
  expectedLoss: number;
  expectedValue: number;
  riskRewardRatio: number;
  evpi: number;
}

function computeExpectedValue(
  calAI: number,
  market: number,
  size: number,
): ExpectedValue {
  const p = clamp(calAI, 0.001, 0.999);
  const m = clamp(market, 0.001, 0.999);
  const S = Math.max(0, size);

  let eGain: number;
  let eLoss: number;

  if (p > m) {
    // Bet YES
    eGain = p * (1 - m) * S;
    eLoss = (1 - p) * m * S;
  } else {
    // Bet NO
    eGain = (1 - p) * m * S;
    eLoss = p * (1 - m) * S;
  }

  const eValue = eGain - eLoss;
  const riskReward = eLoss > 0.0001 ? eGain / eLoss : eGain > 0 ? Infinity : 0;

  // EVPI: value of perfect information
  const perfectEV = p * (1 - m) * S + (1 - p) * m * S;
  const currentEV = Math.max(eValue, 0);
  const evpi = perfectEV - currentEV;

  return { expectedGain: eGain, expectedLoss: eLoss, expectedValue: eValue, riskRewardRatio: riskReward, evpi };
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 9 — SIGNAL CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════
//
// A signal is classified along two axes:
//   1. Effective edge magnitude (after all adjustments)
//   2. Composite confidence
//   3. Information ratio (edge / uncertainty — a quasi-Sharpe)
//
// We require convergence of all three for a "strong" signal:
//   strong:   |eff. edge| > 0.06  AND  confidence > 0.60  AND  IR > 0.5
//   moderate: |eff. edge| > 0.03  AND  confidence > 0.40  AND  IR > 0.25
//   weak:     |eff. edge| > 0.01  AND  confidence > 0.25
//   none:     otherwise

function classifySignal(
  absEffectiveEdge: number,
  confidence: number,
  infoRatio: number,
): SignalStrength {
  if (absEffectiveEdge > 0.06 && confidence > 0.60 && infoRatio > 0.5) return "strong";
  if (absEffectiveEdge > 0.03 && confidence > 0.40 && infoRatio > 0.25) return "moderate";
  if (absEffectiveEdge > 0.01 && confidence > 0.25) return "weak";
  return "none";
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORTING COMPUTATIONS
// ═══════════════════════════════════════════════════════════════════════════

// --- Beta distribution ---

function betaVariance(a: number, b: number): number {
  const sum = a + b;
  return (a * b) / (sum * sum * (sum + 1));
}

// --- Log-odds edge ---

/**
 * Edge in log-odds (logit) space.
 *
 * Raw probability difference is misleading: 5% edge at 50% is very
 * different from 5% at 95%. Log-odds normalizes for this.
 *
 *   logit(p) = ln(p / (1 − p))
 *   logOddsEdge = logit(pAI) − logit(pMarket)
 *
 * Interpretable as the log-likelihood ratio between the AI and market
 * models. Positive = AI thinks event is more likely.
 */
function logOddsEdge(pAI: number, pMarket: number): number {
  return logit(clamp(pAI, 0.001, 0.999)) - logit(clamp(pMarket, 0.001, 0.999));
}

// --- Liquidity scoring ---

function computeLiquidityFromOB(ob: OrderBookMetrics): number {
  // From orderbook: combine spread tightness and depth
  const spreadScore = 1 / (1 + 50 * ob.spreadPct);
  const depthScore = sigmoid(Math.log10(Math.max(1, ob.totalDepth)), 3.0, 1.5);
  return 0.6 * spreadScore + 0.4 * depthScore;
}

function computeLiquidityFromBasics(spread: number, volume: number): number {
  const spreadScore = 1 / (1 + 40 * Math.max(0, spread));
  const volumeScore = sigmoid(Math.log10(Math.max(1, volume)), Math.log10(5000), 1);
  return 0.6 * spreadScore + 0.4 * volumeScore;
}

// --- Sentiment alignment ---

/**
 * Score how well news sentiment aligns with the AI's edge direction.
 *
 * If AI is bullish (calAI > market) and sentiment is positive,
 * the signals reinforce → score near 1.0.
 * If they conflict → score drops → reduces composite confidence.
 * No sentiment data → neutral 0.5 (no penalty, no boost).
 *
 * Uses tanh squashing for smooth, bounded output.
 */
function computeSentimentAlignment(
  score: number | undefined | null,
  calAI: number,
  market: number,
): number {
  if (score == null) return 0.5;
  const edgeDir = calAI - market;
  const alignment = edgeDir * score;
  return 0.5 + 0.5 * Math.tanh(alignment * 5);
}

// --- Orderbook confirmation ---

/**
 * Does the orderbook's depth imbalance confirm the AI's edge direction?
 *
 * If AI is bullish (calAI > market) and bids dominate (imbalance > 0),
 * the book confirms the AI's thesis → higher score.
 *
 * Conversely, if the AI disagrees with the book's directional pressure,
 * it may be trading against informed participants → lower score.
 *
 * No orderbook data → neutral 0.5.
 */
function computeOBConfirmation(
  ob: OrderBookMetrics | null,
  calAI: number,
  market: number,
): number {
  if (!ob) return 0.5;
  const edgeDir = calAI - market;
  const confirmation = edgeDir * ob.depthImbalance;
  return 0.5 + 0.5 * Math.tanh(confirmation * 3);
}

// --- Market efficiency fallback ---

function estimateEfficiencyFromBasics(spread: number, volume: number): number {
  const spreadScore = 1 / (1 + 50 * spread);
  const volScore = sigmoid(Math.log10(Math.max(1, volume)), Math.log10(5000), 1);
  return 0.5 * spreadScore + 0.5 * volScore;
}

function estimateSlippageFromSpread(spread: number): number {
  // Simple estimate: slippage ≈ half the spread
  return Math.max(0, spread / 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function logit(p: number): number {
  return Math.log(p / (1 - p));
}

function invLogit(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function sigmoid(x: number, mid: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - mid)));
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function round4(x: number): number {
  return Math.round(x * 10000) / 10000;
}
