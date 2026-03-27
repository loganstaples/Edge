// ═══════════════════════════════════════════════════════════════════════════
// Orderbook Microstructure Analysis
// ═══════════════════════════════════════════════════════════════════════════
//
// Extracts market-quality signals from raw orderbook data. These signals
// feed into the confidence scoring pipeline as indicators of market
// consensus strength, execution feasibility, and directional pressure.
//
// Key metrics:
//   - Effective spread: true cost of a round-trip trade
//   - Depth imbalance: asymmetry between bid and ask liquidity
//   - VWAP slippage: price impact of executing a given order size
//   - Market efficiency proxy: deep + tight + balanced = efficient

import type { PolymarketOrderBook } from "@/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface OrderBookMetrics {
  /** Best bid price */
  bestBid: number;
  /** Best ask price */
  bestAsk: number;
  /** Midpoint price: (bestBid + bestAsk) / 2 */
  midpoint: number;
  /** Effective spread: bestAsk - bestBid */
  effectiveSpread: number;
  /** Spread as percentage of midpoint */
  spreadPct: number;
  /** Total USD liquidity on bid side (top 10 levels) */
  bidDepth: number;
  /** Total USD liquidity on ask side (top 10 levels) */
  askDepth: number;
  /** Total depth both sides */
  totalDepth: number;
  /**
   * Depth imbalance ∈ [-1, 1].
   *   > 0 → more bid liquidity → buying pressure → bullish microstructure
   *   < 0 → more ask liquidity → selling pressure → bearish microstructure
   *
   * Formula: (bidDepth - askDepth) / (bidDepth + askDepth)
   */
  depthImbalance: number;
  /**
   * VWAP for a hypothetical buy order of `targetSize` USD.
   * Walks the ask side of the book to compute volume-weighted average price.
   */
  vwapBuy: number;
  /**
   * VWAP for a hypothetical sell order of `targetSize` USD.
   * Walks the bid side of the book.
   */
  vwapSell: number;
  /**
   * Slippage: how much worse than midpoint you'd get for the target size.
   * Average of buy and sell slippage as a fraction of midpoint.
   *   slippage = ((vwapBuy - mid) + (mid - vwapSell)) / (2 × mid)
   */
  slippagePct: number;
  /**
   * Market efficiency proxy ∈ [0, 1].
   * Combines spread tightness, depth, and balance. Higher = more efficient
   * = harder to find genuine edge against.
   *
   *   efficiency = w₁ × spreadScore + w₂ × depthScore + w₃ × balanceScore
   *   where:
   *     spreadScore = 1 / (1 + 50 × spreadPct)   — tight spread → 1
   *     depthScore  = sigmoid(log₁₀(totalDepth), 3.5, 1.5)  — deep book → 1
   *     balanceScore = 1 - |depthImbalance|  — balanced → 1
   */
  marketEfficiency: number;
}

// ---------------------------------------------------------------------------
// Core analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze a Polymarket CLOB orderbook and extract microstructure metrics.
 *
 * @param book - Raw orderbook from `fetchPolymarketOrderBook`
 * @param targetSizeUSD - Size of hypothetical order for VWAP/slippage calc
 * @returns OrderBookMetrics or null if the book is empty/invalid
 */
export function analyzeOrderBook(
  book: PolymarketOrderBook,
  targetSizeUSD: number = 25,
): OrderBookMetrics | null {
  const bids = (book.bids ?? [])
    .map((b) => ({ price: parseFloat(b.price), size: parseFloat(b.size) }))
    .filter((b) => b.price > 0 && b.size > 0)
    .sort((a, b) => b.price - a.price); // highest bid first

  const asks = (book.asks ?? [])
    .map((a) => ({ price: parseFloat(a.price), size: parseFloat(a.size) }))
    .filter((a) => a.price > 0 && a.size > 0)
    .sort((a, b) => a.price - b.price); // lowest ask first

  if (bids.length === 0 || asks.length === 0) return null;

  const bestBid = bids[0].price;
  const bestAsk = asks[0].price;
  if (bestBid >= bestAsk) {
    // Crossed book — use last trade price as midpoint fallback
    const ltp = parseFloat(book.last_trade_price || "0.5");
    return fallbackMetrics(ltp, targetSizeUSD);
  }

  const midpoint = (bestBid + bestAsk) / 2;
  const effectiveSpread = bestAsk - bestBid;
  const spreadPct = midpoint > 0 ? effectiveSpread / midpoint : 0;

  // --- Depth (top 10 levels each side, in USD-equivalent) ---
  const TOP_LEVELS = 10;
  const bidDepth = bids
    .slice(0, TOP_LEVELS)
    .reduce((sum, b) => sum + b.price * b.size, 0);
  const askDepth = asks
    .slice(0, TOP_LEVELS)
    .reduce((sum, a) => sum + a.price * a.size, 0);
  const totalDepth = bidDepth + askDepth;
  const depthImbalance =
    totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;

  // --- VWAP calculation ---
  const vwapBuy = computeVWAP(asks, targetSizeUSD, "buy");
  const vwapSell = computeVWAP(bids, targetSizeUSD, "sell");

  const buySlip = midpoint > 0 ? (vwapBuy - midpoint) / midpoint : 0;
  const sellSlip = midpoint > 0 ? (midpoint - vwapSell) / midpoint : 0;
  const slippagePct = (Math.max(0, buySlip) + Math.max(0, sellSlip)) / 2;

  // --- Market efficiency composite ---
  const spreadScore = 1 / (1 + 50 * spreadPct);
  const depthScore = sigmoid(
    Math.log10(Math.max(1, totalDepth)),
    3.5,
    1.5,
  );
  const balanceScore = 1 - Math.abs(depthImbalance);
  const marketEfficiency =
    0.40 * spreadScore + 0.35 * depthScore + 0.25 * balanceScore;

  return {
    bestBid: round(bestBid),
    bestAsk: round(bestAsk),
    midpoint: round(midpoint),
    effectiveSpread: round(effectiveSpread),
    spreadPct: round(spreadPct),
    bidDepth: round(bidDepth),
    askDepth: round(askDepth),
    totalDepth: round(totalDepth),
    depthImbalance: round(depthImbalance),
    vwapBuy: round(vwapBuy),
    vwapSell: round(vwapSell),
    slippagePct: round(slippagePct),
    marketEfficiency: round(marketEfficiency),
  };
}

// ---------------------------------------------------------------------------
// VWAP walk-the-book
// ---------------------------------------------------------------------------

/**
 * Walk the order book to compute Volume-Weighted Average Price for a
 * hypothetical order of `targetUSD` size.
 *
 * For a buy: walk asks (ascending price). For a sell: walk bids (descending).
 * Returns the average fill price. If the book is too thin, returns the
 * worst price available.
 */
function computeVWAP(
  levels: { price: number; size: number }[],
  targetUSD: number,
  _side: "buy" | "sell",
): number {
  let remaining = targetUSD;
  let totalCost = 0;
  let totalQty = 0;

  for (const level of levels) {
    // In a prediction market, "size" is number of contracts, "price" is cost per contract
    const levelUSD = level.price * level.size;
    const fillUSD = Math.min(remaining, levelUSD);
    const fillQty = level.size * (fillUSD / levelUSD);

    totalCost += fillQty * level.price;
    totalQty += fillQty;
    remaining -= fillUSD;

    if (remaining <= 0) break;
  }

  if (totalQty === 0) {
    return levels.length > 0 ? levels[levels.length - 1].price : 0.5;
  }

  return totalCost / totalQty;
}

// ---------------------------------------------------------------------------
// Fallback for empty/crossed books
// ---------------------------------------------------------------------------

function fallbackMetrics(
  midpoint: number,
  _targetSizeUSD: number,
): OrderBookMetrics {
  return {
    bestBid: midpoint - 0.005,
    bestAsk: midpoint + 0.005,
    midpoint,
    effectiveSpread: 0.01,
    spreadPct: midpoint > 0 ? 0.01 / midpoint : 0.02,
    bidDepth: 0,
    askDepth: 0,
    totalDepth: 0,
    depthImbalance: 0,
    vwapBuy: midpoint + 0.005,
    vwapSell: midpoint - 0.005,
    slippagePct: 0.01,
    marketEfficiency: 0.3,
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function sigmoid(x: number, midpoint: number, steepness: number): number {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

function round(x: number, decimals: number = 6): number {
  const factor = 10 ** decimals;
  return Math.round(x * factor) / factor;
}
