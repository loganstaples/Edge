# Edge

Edge is a no-code platform for building, deploying, and sharing autonomous prediction market trading strategies. Users describe a strategy in plain English, and AI generates a complete visual node graph that can be backtested tick-by-tick against real market data from Gemini and Polymarket. Strategies execute through a composable node architecture spanning data ingestion, AI analysis, decision logic, and trade execution. Finished strategies can be minted as NFTs with encrypted logic stored on 0g decentralized storage, enabling trustless ownership and transfer of proprietary trading algorithms. Edge turns prediction market trading from an engineering problem into a creative one.

---

## How It Works

### 1. Describe

The user types a natural language strategy description into the builder. Claude receives the prompt alongside a structured specification of all 23 node types, their input/output schemas, connectivity rules, and known anti-patterns. The model returns a complete strategy graph as JSON: nodes with types, configurations, and positions; connections with source/target handles. The backend validates the graph for cycles, enforces entry-point rules (at least one standalone data source), and applies DAG layout via dagre. The user sees a fully wired visual strategy on canvas, ready to run.

### 2. Backtest

The backtesting engine fetches real historical price data from Gemini candle endpoints and Polymarket price history APIs. It discovers markets matching each data source node's configuration, retrieves up to 7 days of hourly candle data per instrument, and replays the strategy tick-by-tick against those prices. AI analysis nodes call Claude with cached results per event to avoid redundant inference. Each tick records equity, drawdown, node outputs, and trade activity. The result includes a full equity curve, individual trade entries/exits with P&L, and aggregate metrics: total return, win rate, Sharpe ratio, max drawdown, and profit factor.

### 3. Own

When a user mints a strategy as an NFT, the client-side encryption pipeline derives an AES-256-GCM key from the user's Phantom wallet signature over a deterministic message (`"Edge Strategy Encryption Key v1"`). The strategy's node graph and connections are encrypted client-side before leaving the browser, uploaded to 0g decentralized storage (returning a content-addressed Merkle root hash), and recorded on-chain as a Solana Metaplex NFT. The encrypted blob is never stored in plaintext on any server. Only the wallet holder can derive the decryption key, so transferring the NFT transfers exclusive access to the underlying strategy logic.

---

## Node Architecture

Strategies are directed acyclic graphs composed of atomic, single-responsibility nodes. Each node type defines a fixed set of configuration parameters and output fields. The execution engine topologically sorts the graph, runs standalone data source nodes first (producing one "river" per result item), then propagates each river through downstream nodes in order. Upstream outputs accumulate in the river, so every downstream node can read every upstream field. Gate nodes set `_gate_result: false` to block all downstream execution. Router nodes selectively activate one output handle, branching the flow.

### Node Types

**Watch** — Data Sources (Blue, `#5B7FFF`)

| Node | Purpose |
|------|---------|
| `news_monitor` | Scan RSS feeds (Reuters, BBC, NYT) and NewsAPI with keyword filtering and tiered source selection |
| `polymarket_feed` | Stream live Polymarket prediction market pricing, orderbook bids/asks, volume, and liquidity |
| `gemini_markets_feed` | Stream Gemini prediction market events with contract pricing, bid/ask spreads, and significant move detection |
| `twitter_monitor` | Monitor X/Twitter for keyword and handle matches with follower count and verification filtering |
| `crypto_price` | Track live cryptocurrency prices via Gemini ticker and candle endpoints across 6 timeframes |
| `onchain_activity` | Monitor whale-scale transactions and wallet activity across Bitcoin, Ethereum, and Solana |
| `calendar_timer` | Fire on interval, daily schedule, or one-shot timestamp triggers |
| `strategy_link` | Read live output from another deployed strategy |

**Think** — AI and Analysis (Purple, `#A855F7`)

| Node | Purpose |
|------|---------|
| `ai_analyst` | LLM-powered analysis via Claude (Haiku/Sonnet/Opus) with structured tool_use for probability estimation and search term extraction |
| `sentiment_scanner` | High-throughput text sentiment classification across general, crypto, political, financial, and sports domains |
| `consensus` | Merge 2-5 probability-like inputs via weighted average or majority voting with disagreement detection |
| `history_tracker` | Track any numeric field over time with trend, slope, streak, and rate-of-change analysis |
| `formula` | Evaluate custom math expressions with variable substitution, conditionals, and aggregate functions |

**Decide** — Logic and Control (Amber, `#F59E0B`)

| Node | Purpose |
|------|---------|
| `edge_calculator` | Compute trading edge with source weighting, temporal decay, liquidity adjustment, and configurable position sizing |
| `arb_detector` | Detect cross-platform price spreads between Polymarket and Gemini with fee-adjusted profit estimation |
| `router` | Route signals to different output branches based on field-level conditions with default fallback |
| `price_alert_decide` | Trigger on price threshold crossings with configurable hold-for duration |
| `cooldown_gate` | Rate-limit downstream triggers with rolling window, max fire count, and direction-aware reset |
| `multi_condition_gate` | AND/OR/Majority gate across multiple inputs with configurable timeout for input validity |

**Act** — Actions (Green, `#00D26A`)

| Node | Purpose |
|------|---------|
| `trade_advanced` | Execute simulated trades with position tracking, scale-in support, P&L computation, and automatic platform detection |
| `alert_advanced` | Multi-channel notifications via in-app console, Twilio SMS, Discord webhooks, and email with template variables |
| `strategy_link_act` | Send commands (pause, resume, adjust sizing, signal) to other deployed strategies |

When a data source node has incoming connections, the upstream river's `search_terms` field overrides its static configuration. This enables reactive pipelines: an AI analyst extracts search terms from a news article, a downstream market feed uses those terms to discover relevant prediction markets, and a second AI analyst estimates a probability specific to the discovered market.

---

## Gemini Prediction Markets API Integration

Gemini serves as the primary market data layer for Edge. Every edge computation, backtest simulation, cryptocurrency price lookup, and cross-platform arbitrage detection runs against Gemini's public REST API. The integration spans seven distinct endpoints across three functional areas: prediction markets, spot trading, and historical data.

### Endpoint Map

| Endpoint | Method | Location in Codebase | Purpose in Edge |
|----------|--------|---------------------|-----------------|
| `/v1/prediction-markets/events` | GET | `lib/data/gemini.ts` — `fetchGeminiEvents()` | Fetch active prediction market events with pagination, category filtering, keyword search, and status filtering. Called by the Gemini Markets Feed node, the backtester's market discovery phase, and the pipeline's candidate assembly. Supports `limit`, `offset`, `category`, `status[]`, and `search` parameters. |
| `/v1/prediction-markets/categories` | GET | `lib/data/gemini.ts` — `fetchGeminiCategories()` | Retrieve available market categories for the Gemini Markets Feed node's category-based watch mode. Populates the node configuration UI. |
| `/v2/ticker/{instrumentSymbol}` | GET | `lib/data/gemini.ts` — `fetchGeminiTicker()` | Fetch real-time bid/ask/last-trade pricing for individual prediction market contracts. Called by the paper trader to price trade entries and update open positions. Also used as a fallback when candle history is insufficient for backtesting. |
| `/v2/ticker/{pair}` | GET | `node-runners/data-sources.ts` — `runCryptoPrice()` | Fetch live cryptocurrency ticker data (open, high, low, close, bid, ask, 24h volume) for the Crypto Price node. Pair format: `btcusd`, `ethusd`, `solusd`, etc. |
| `/v2/candles/{pair}/{interval}` | GET | `node-runners/data-sources.ts` — `runCryptoPrice()` | Fetch OHLCV candle data at 1m, 5m, 15m, 1hr, or 6hr intervals for multi-timeframe cryptocurrency analysis in the Crypto Price node. Used to compute price change over the configured timeframe. |
| `/v2/candles/{instrumentSymbol}/1hr` | GET | `engine/backtester.ts` — `fetchGeminiHistory()` | Fetch up to 7 days of hourly candle data for prediction market contracts. Each candle returns `[timestamp_ms, open, high, low, close, volume]`. The backtester extracts close prices, sorts by timestamp, and replays them tick-by-tick against the strategy graph. This is the primary historical data source for all Gemini-market backtests. |
| `/v1/trades/{pair}` | GET | `node-runners/data-sources.ts` — `runOnChainActivity()` | Fetch recent trade history for BTC, ETH, and SOL pairs. The On-Chain Activity node uses trade size and price to compute dollar values, generating whale alerts when transactions exceed a configurable threshold (default: $1M). |

### Deep Integration Architecture

**Prediction Market Data Pipeline.** The Gemini Markets Feed node (`runGeminiMarketsFeed`) calls `fetchAllActiveGeminiEvents()`, which paginates through the `/v1/prediction-markets/events` endpoint in batches of 100 until all active events are retrieved. Events are filtered by keyword match against the title and by category. For each matching event, the node extracts the first contract's implied probability via `getImpliedProbability()`:

```
Implied Probability = lastTradePrice (preferred)
                    | (bestBid + bestAsk) / 2 (midpoint fallback)
                    | buy.yes price (final fallback)
                    | 0.5 (no data)
```

The node tracks prices per instrument symbol across ticks, computing percentage moves to flag significant price movements when the move exceeds the configured `alert_threshold` (default: 5%). Outputs include `contract_price`, `bid_price`, `ask_price`, `spread`, `liquidity`, `instrument_symbol`, and `significant_move`, all of which feed directly into downstream edge calculation and trade execution nodes.

**Implied Probability as Edge Input.** The `contract_price` output from Gemini flows into the Edge Calculator node as the `marketPrice` term in the core edge formula. The AI analyst's estimated true probability minus the Gemini-derived market price produces the raw edge signal. Every adjustment factor (source weighting, temporal decay, liquidity scaling) then operates on this Gemini-sourced baseline. This means Gemini's prediction market pricing is the denominator in every edge computation — the reference against which the AI's thesis is measured.

**Cross-Platform Arbitrage.** The Arbitrage Detector node resolves two prices from the river: `yes_price` (Polymarket) and `contract_price` (Gemini). It computes the absolute spread, percentage spread relative to midpoint, and fee-adjusted profit estimate (default: 2% per platform when `net_of_fees` is enabled). If the spread exceeds the `min_spread` threshold, it outputs the buy/sell platform assignment and estimated profit. The pipeline module assembles candidates from both platforms, and Claude's arbitrage matching system identifies same-event pairs across Gemini and Polymarket for spread detection.

**Historical Backtesting.** The backtester calls `fetchGeminiHistory(instrumentSymbol)` to retrieve hourly candle data, extracting close prices as the historical price series. During market discovery, it fetches all active Gemini events matching the strategy's data source configurations, retrieves price history for up to 6 markets per source (to respect rate limits), and when candle data is sparse, falls back to `fetchGeminiTicker()` for a single-point snapshot. The tick loop interpolates between historical price points and feeds each price into the strategy graph as if it were a live `contract_price` value.

**Cryptocurrency Data.** The Crypto Price node makes two Gemini calls per execution: a ticker request for the current price and a candle request for the configured timeframe. It maps user-facing timeframes to Gemini intervals (`"1m"` to `"1m"`, `"5m"` to `"5m"`, `"15m"` to `"15m"`, `"1h"` to `"1hr"`, `"4h"` to `"6hr"`), then computes percentage change from the candle open to the current price. This feeds into strategies that combine cryptocurrency price signals with prediction market positions.

**Trade Execution Pricing.** When `trade_advanced` nodes execute on Gemini-sourced markets, the paper trader calls `fetchGeminiTicker(instrumentSymbol)` to price both new entries and open position updates. Entry prices use the bid (or close as fallback), and periodic mark-to-market updates use the same endpoint to compute unrealized P&L.

### Integration Summary

Gemini is not a peripheral data source — it is the foundational pricing layer. Prediction market events provide the market probabilities that drive edge calculation. Candle history provides the price series that power backtesting. Ticker data provides the real-time pricing that drives paper trading. Trade history provides the whale detection signal for the on-chain activity node. Cryptocurrency tickers and candles provide the multi-timeframe price analysis for crypto-correlated strategies. Every computational path in the platform either starts with, passes through, or terminates against Gemini data.

---

## Confidence Scoring and Edge Computation Framework

Edge implements two complementary edge computation systems: a **node-level Edge Calculator** used within strategy graphs for real-time decision-making, and a **full Bayesian pipeline** (`lib/engine/edge.ts`) used in the analysis pipeline for comprehensive signal scoring. Both are documented here.

### Node-Level Edge Calculator

The Edge Calculator node (`logic-nodes.ts:runEdgeCalculator`) is the decision gate inside strategy graphs. It reads an AI-estimated probability and a market price from the upstream river, applies three adjustment factors, and outputs a direction signal with position sizing.

#### Core Formula

```
finalEdge = rawEdge * sourceWeight * timeDecay * liquidityFactor
```

Where:

```
rawEdge = P_ai - P_market
```

`P_ai` is the upstream `analyst_probability` or `consensus_probability`. `P_market` is the upstream `yes_price` (Polymarket), `contract_price` (Gemini), or `current_price` (crypto).

#### Adjustment Factor 1: Source Quality Weight

Maps the AI analyst's self-reported confidence to a multiplicative weight:

| Confidence Level | Weight |
|-----------------|--------|
| `low` | 0.50 |
| `medium` | 0.70 |
| `high` | 0.85 |
| `very_high` | 0.95 |

A low-confidence estimate has its raw edge halved. A high-confidence estimate retains 85% of the signal.

#### Adjustment Factor 2: Temporal Decay

Information value decays exponentially from the time of the triggering event:

```
timeDecay = 0.5 ^ (newsAgeMinutes / decayHalflife)
```

The half-life is configurable per node (default: 60 minutes). A 60-minute-old signal retains 50% of its weight. A 2-hour-old signal retains 25%. If no `published_at` timestamp is present in the river (e.g., the probability came from a non-news source), `timeDecay` is 1.0.

#### Adjustment Factor 3: Liquidity Confidence

Markets with thin liquidity may have prices that are unreliable indicators of true consensus:

```
liquidityFactor = clamp(log10(volume + liquidity) / 6, 0.2, 1.0)
```

| Combined Volume + Liquidity | Factor |
|----------------------------|--------|
| $1 | 0.20 (floor) |
| $1,000 | 0.50 |
| $100,000 | 0.83 |
| $1,000,000 | 1.00 (ceiling) |

The log-scale ensures diminishing returns: the difference between $100 and $1,000 in liquidity matters more than between $100K and $1M.

#### Position Sizing

When `|finalEdgePct| >= min_edge` (default: 5%), the node computes a suggested position size using one of four modes:

| Mode | Formula | Cap |
|------|---------|-----|
| **Fixed** | `fixed_size` (default: $25) | None |
| **Percentage** | `bankroll * (pct_size / 100)` (default: 5%) | None |
| **Kelly** | `bankroll * max(0, finalEdge / odds)` where `odds = (1/marketPrice) - 1` | 25% of bankroll |
| **Proportional** | `bankroll * min(0.25, |finalEdge|)` | 25% of bankroll |

If the edge is below the threshold, `suggestedSize` is 0 and `_gate_result` is `false`, blocking all downstream nodes.

#### Worked Example

Inputs from the river:
- `analyst_probability`: 0.72 (AI thinks 72% likely)
- `contract_price`: 0.55 (Gemini market prices at 55 cents)
- `analyst_confidence`: "high"
- `published_at`: 45 minutes ago
- `volume`: 50,000
- `liquidity`: 12,000
- Node config: `min_edge`: 5, `decay_halflife`: 60, `sizing_mode`: "kelly"

Step 1 — Raw Edge:
```
rawEdge = 0.72 - 0.55 = 0.17
```

Step 2 — Source Weight:
```
sourceWeight = 0.85 (high confidence)
```

Step 3 — Temporal Decay:
```
timeDecay = 0.5 ^ (45 / 60) = 0.5 ^ 0.75 = 0.5946
```

Step 4 — Liquidity Factor:
```
liquidityFactor = log10(50000 + 12000) / 6 = log10(62000) / 6 = 4.792 / 6 = 0.799
```

Step 5 — Final Edge:
```
finalEdge = 0.17 * 0.85 * 0.5946 * 0.799 = 0.0687
finalEdgePct = 6.87%
```

Step 6 — Gate Check:
```
|6.87%| >= 5% threshold => gate passes, direction = "bullish"
```

Step 7 — Kelly Sizing:
```
odds = (1 / 0.55) - 1 = 0.818
kellyFrac = max(0, 0.0687 / 0.818) = 0.084
suggestedSize = min(1000 * 0.25, 1000 * 0.084) = $84.00
```

Output: `ec_edge_pct: 6.87`, `ec_direction: "bullish"`, `ec_suggested_size: 84.00`, `_gate_result: true`.

---

### Full Bayesian Edge Pipeline

The comprehensive framework in `lib/engine/edge.ts` extends the node-level calculator with a 9-stage pipeline that adds probabilistic modeling, calibration, information-theoretic analysis, and multi-factor confidence scoring. It is used by the analysis pipeline for signal generation and ranking.

#### Stage 1: Beta Distribution Modeling

The AI's point estimate `p_hat` is modeled as the mean of a Beta distribution to capture epistemic uncertainty:

```
alpha = p_hat * kappa
beta  = (1 - p_hat) * kappa
Var[X] = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
sigma  = sqrt(Var[X])
```

Concentration parameter `kappa` encodes confidence:

| Confidence | kappa | Approximate StdDev |
|-----------|-------|-------------------|
| low | 8 | 0.16 |
| medium | 20 | 0.10 |
| high | 50 | 0.06 |

Higher `kappa` concentrates the distribution tighter around the point estimate. The standard deviation `sigma` is used downstream as the denominator for the information ratio.

#### Stage 2: Platt Scaling Calibration

LLM probability estimates exhibit non-linear overconfidence — models are reasonably calibrated near 50% but systematically overshoot near 0% and 100%. Platt scaling corrects this via a sigmoid transform in log-odds space:

```
p_cal = sigmoid(a * logit(p_hat) + b)
```

Where `a = 0.82` (compression slope) and `b = 0.0` (no directional bias). The effect:

| Raw Estimate | Logit | Calibrated |
|-------------|-------|-----------|
| 0.50 | 0.00 | 0.500 |
| 0.70 | 0.85 | 0.667 |
| 0.90 | 2.20 | 0.858 |
| 0.95 | 2.94 | 0.918 |
| 0.10 | -2.20 | 0.142 |

This is superior to linear shrinkage (`p_cal = lambda * p + (1 - lambda) * 0.5`) because the bias is non-linear: a 95% estimate needs stronger correction than a 70% estimate.

#### Stage 3: Orderbook Microstructure

When orderbook data is available, the system extracts:
- **Effective spread** and spread percentage (execution cost)
- **Bid/ask depth** across top 10 levels (liquidity)
- **VWAP slippage** for the target position size (price impact)
- **Depth imbalance** = `(bidDepth - askDepth) / (bidDepth + askDepth)` (directional pressure)
- **Market efficiency** = `0.40 * spreadScore + 0.35 * depthScore + 0.25 * balanceScore`

When orderbook data is unavailable, efficiency and slippage are estimated from spread and volume.

#### Stage 4: Information-Theoretic Divergence

Three information-theoretic metrics quantify the AI-vs-market disagreement:

**KL Divergence** (Bernoulli):
```
KL(P || Q) = p * ln(p/q) + (1-p) * ln((1-p)/(1-q))
```
Measures information lost when using market Q to approximate AI P. Unlike raw edge, KL is scale-aware: a 5% disagreement at p=50% is very different from 5% at p=95%.

**Shannon Entropy** (Bernoulli):
```
H(p) = -p * ln(p) - (1-p) * ln(1-p)
```
Maximum at p=0.5 (~0.693 nats). Lower entropy indicates the AI is more confident.

**Information Ratio**:
```
IR = |p_cal - p_market| / sigma
```
Edge per unit of uncertainty — a quasi-Sharpe ratio for the signal. Used in the final signal classification stage.

#### Stage 5: Multi-Factor Confidence Aggregation

Nine orthogonal confidence factors, each normalized to [0, 1], are combined via a fixed-weight linear composite:

| Factor | Weight | Computation |
|--------|--------|-------------|
| AI Confidence | 0.20 | low: 0.30, medium: 0.60, high: 0.90 |
| Source Corroboration | 0.10 | `sigmoid(nSources, midpoint=3, steepness=1.2)` — saturates at ~5 sources |
| Reasoning Depth | 0.08 | `min(1, nKeyFactors / 7)` — linear, capped at 7 |
| Liquidity Quality | 0.15 | From orderbook: `0.6 * spreadScore + 0.4 * depthScore`. Without: `0.6 * (1/(1+40*spread)) + 0.4 * volumeScore` |
| Temporal Freshness | 0.10 | `exp(-0.1733 * ageHours)` — 4-hour half-life |
| Extremity Penalty | 0.07 | `4 * p_cal * (1 - p_cal)` — peaks at p=0.5, drops to 0 at extremes |
| Sentiment Alignment | 0.10 | `0.5 + 0.5 * tanh(edgeDirection * sentimentScore * 5)` — reinforcing signals push toward 1.0, conflicting toward 0.0 |
| Orderbook Confirmation | 0.10 | `0.5 + 0.5 * tanh(edgeDirection * depthImbalance * 3)` — book pressure confirming AI thesis boosts confidence |
| Market Efficiency Adj | 0.10 | `1 - marketEfficiency` — harder to beat efficient markets, so confidence drops |

**Composite Confidence** = weighted sum of all nine factors. Weights sum to 1.0.

#### Stage 6: Effective Edge

```
E_eff = (p_cal - p_market) * C * (1 - slippage) * (1 - eta * efficiency)
```

Where:
- `C` = composite confidence from Stage 5
- `slippage` = estimated execution cost (half-spread or VWAP-derived)
- `eta` = 0.3 (efficiency discount factor)

At maximum market efficiency (1.0), the edge is discounted 30%. At typical efficiency (~0.5), the discount is 15%.

#### Stage 7: Kelly Criterion with Drawdown Constraint

For a binary prediction market contract at price `m`:

**YES bet** (when `p_cal > m`):
```
odds = (1 - m) / m
f* = (odds * p - q) / odds
```

**NO bet** (when `p_cal < m`):
```
odds = m / (1 - m)
f* = (odds * q - p) / odds
```

Three safety constraints:
1. **Half-Kelly**: `f * 0.5` (classic variance reduction)
2. **Confidence scaling**: `f * compositeConfidence`
3. **Hard caps**: `min(f, 0.15, 0.05)` — maximum 15% Kelly fraction, maximum 5% bankroll per trade

#### Stage 8: Expected Value Framework

For a YES trade at market price `m` with AI probability `p` and position size `S`:

```
E[gain] = p * (1 - m) * S
E[loss] = (1 - p) * m * S
E[value] = E[gain] - E[loss]
Risk/Reward = E[gain] / E[loss]
```

**EVPI** (Expected Value of Perfect Information) quantifies the value of resolving remaining uncertainty:
```
E[V|perfect] = p * (1 - m) * S + (1 - p) * m * S
EVPI = E[V|perfect] - max(E[V|current], 0)
```

#### Stage 9: Signal Classification

Three-factor convergence test:

| Signal | Effective Edge | Confidence | Information Ratio |
|--------|---------------|------------|------------------|
| **strong** | > 6% | > 0.60 | > 0.50 |
| **moderate** | > 3% | > 0.40 | > 0.25 |
| **weak** | > 1% | > 0.25 | — |
| **none** | <= 1% | <= 0.25 | — |

All three conditions must be met for a given classification. This prevents high-edge/low-confidence situations from triggering trades.

#### Full Pipeline Worked Example

Scenario: A news article triggers an AI estimate of 72% on a Gemini market priced at 55 cents. High confidence. 3 corroborating sources. 2 key reasoning factors. Published 2 hours ago. Volume: $50,000. Sentiment score: +0.3.

**Stage 1** — Beta Distribution:
```
kappa = 50, alpha = 36, beta = 14
Var = (36 * 14) / (50^2 * 51) = 504 / 127500 = 0.00395
sigma = 0.0629
```

**Stage 2** — Platt Calibration:
```
logit(0.72) = ln(0.72/0.28) = 0.9445
p_cal = sigmoid(0.82 * 0.9445 + 0) = sigmoid(0.7745) = 0.685
```

**Stage 4** — Information Metrics:
```
KL(0.685 || 0.55) = 0.685*ln(0.685/0.55) + 0.315*ln(0.315/0.45) = 0.0365
H(0.685) = -0.685*ln(0.685) - 0.315*ln(0.315) = 0.6306
IR = |0.685 - 0.55| / 0.0629 = 2.147
```

**Stage 5** — Confidence Factors:
```
aiConfidence          = 0.90   (high)
sourceCorroboration   = 0.50   (sigmoid(3, 3, 1.2))
reasoningDepth        = 0.286  (2/7)
liquidityQuality      = 0.70   (estimated from spread/volume)
temporalFreshness     = 0.707  (exp(-0.1733 * 2))
extremityPenalty      = 0.863  (4 * 0.685 * 0.315)
sentimentAlignment    = 0.59   (0.5 + 0.5*tanh(0.135 * 5))
orderBookConfirmation = 0.50   (no orderbook, neutral)
marketEfficiencyAdj   = 0.55   (1 - estimated 0.45)

Composite = 0.20(0.90) + 0.10(0.50) + 0.08(0.286) + 0.15(0.70) +
            0.10(0.707) + 0.07(0.863) + 0.10(0.59) + 0.10(0.50) + 0.10(0.55)
          = 0.180 + 0.050 + 0.023 + 0.105 + 0.071 + 0.060 + 0.059 + 0.050 + 0.055
          = 0.653
```

**Stage 6** — Effective Edge:
```
E_cal = 0.685 - 0.55 = 0.135
slippage = 0.01 (estimated)
efficiency = 0.45
E_eff = 0.135 * 0.653 * (1 - 0.01) * (1 - 0.3*0.45) = 0.135 * 0.653 * 0.99 * 0.865 = 0.0755
```

**Stage 7** — Kelly:
```
odds = (1 - 0.55) / 0.55 = 0.818
f* = (0.818 * 0.685 - 0.315) / 0.818 = 0.300
f_safe = min(0.300 * 0.5 * 0.653, 0.15, 0.05) = min(0.098, 0.15, 0.05) = 0.05
suggestedSize = 0.05 * $1000 = $50.00
```

**Stage 8** — Expected Value:
```
E[gain] = 0.685 * (1 - 0.55) * 50 = $15.41
E[loss] = 0.315 * 0.55 * 50 = $8.66
E[value] = $6.75
Risk/Reward = 1.78:1
```

**Stage 9** — Signal:
```
|E_eff| = 0.0755 > 0.06, Confidence = 0.653 > 0.60, IR = 2.147 > 0.5
=> STRONG signal
```

---

## Data Ingestion Strategy

The platform supports six data source types, each implemented as a standalone node runner that fetches real external data and normalizes it into a consistent river format.

### News (NewsAPI + RSS)

The `news_monitor` node fetches articles from two sources: NewsAPI (`/v2/top-headlines` and `/v2/everything` endpoints with keyword, category, and date filtering) and three hardcoded RSS feeds (Reuters, BBC, NY Times) parsed via `rss-parser`. Articles are filtered by keyword match and source tier (`top`, `all_major`, `everything`). Each article becomes a separate river with `headline`, `source_name`, `source_tier`, `published_at`, and `url`. The `published_at` timestamp feeds directly into temporal decay calculations in the Edge Calculator.

### Prediction Markets (Gemini + Polymarket)

Two parallel data source nodes cover the two major platforms. The `gemini_markets_feed` node paginates through all active Gemini events, filters by keyword and category, extracts implied probabilities, and tracks price movements for significant move detection. The `polymarket_feed` node queries the Polymarket CLOB API (`/sampling-markets` with cursor-based pagination, `/book` for orderbook depth, `/midpoint` for current price). Both output the pricing fields that the Edge Calculator consumes as `marketPrice`.

### Cryptocurrency Prices (Gemini Spot)

The `crypto_price` node calls Gemini's spot trading API for live ticker and candle data across six timeframes. It computes percentage change, absolute change, and 24h volume/high/low. This enables strategies that condition prediction market trades on cryptocurrency price movements.

### On-Chain Activity (Gemini Trades as Proxy)

The `onchain_activity` node monitors large transactions by fetching recent trades from Gemini's `/v1/trades/{pair}` endpoint for BTC, ETH, and SOL. Dollar values are computed from trade amounts and prices, filtered against a minimum threshold (default: $1M), and formatted as whale alerts. This provides an on-chain signal without requiring full blockchain indexing infrastructure.

### Social Media (Simulated)

The `twitter_monitor` node uses news articles as a proxy for tweet content, applying deterministic pseudo-random generation (seeded on article title hash) for follower counts, verification status, and engagement metrics. It supports keyword filtering, handle watching, follower minimums, and verification-only modes.

### Timer Events

The `calendar_timer` node generates time-based triggers in three modes: interval (fire every N seconds), scheduled (fire at specific times on specific days), and one-shot (fire once at a given timestamp). This supports time-based rebalancing and scheduled strategy execution.

### Source Reliability in the Computation Pipeline

Data source reliability affects downstream computation through two mechanisms. First, the `source_tier` field from news monitors feeds into the AI analyst's context, influencing the confidence level it assigns to its probability estimate, which in turn determines the `sourceWeight` multiplier in the Edge Calculator. Second, the `volume` and `liquidity` fields from market feeds directly scale the `liquidityFactor` — thin markets produce lower-confidence edge signals regardless of the AI's conviction. The `consensus` node can aggregate probabilities from multiple data paths, and its `consensus_disagreement` output flags when sources conflict, providing a quantitative measure of source agreement.

---

## Marketplace and Strategy NFTs

### Marketplace

The marketplace provides a community-driven discovery layer for trading strategies. Strategies are displayed as cards with performance metrics including total return, win rate, average edge, Sharpe ratio, max drawdown, number of trades, and node count. Users can filter by category (Crypto, Politics, Economics, Sports, Multi-Market, Arbitrage), search across names, descriptions, and creators, and sort by performance, popularity, recency, or win rate. Each strategy card shows a sparkline equity curve. Selecting a strategy opens a detail modal with the full performance breakdown. Users can clone any public strategy into their own builder to modify and deploy.

### Strategy NFTs

The NFT pipeline transforms a strategy from a local draft into a transferable, encrypted on-chain asset:

1. **Client-Side Encryption.** The user's Phantom wallet signs the deterministic message `"Edge Strategy Encryption Key v1"`. The ed25519 signature is SHA-256 hashed to produce a 256-bit AES-GCM key. The strategy's `{nodes, connections}` are JSON-serialized, encrypted with a random 12-byte IV, and base64-encoded. The key derivation is deterministic — the same wallet always produces the same key, eliminating key storage requirements.

2. **Decentralized Storage.** The encrypted blob is uploaded to 0g Storage via the `@0glabs/0g-ts-sdk`, which computes a Merkle tree over the data and stores it on the 0g testnet (EVM RPC: `evmrpc-testnet.0g.ai`, Indexer: `indexer-storage-testnet-standard.0g.ai`, Flow contract: `0xbD2C3F0E65eDF5582141C35969d66e34e3bDFF68`). The returned root hash is a content-addressable identifier for the encrypted strategy. If 0g is unavailable, the encrypted data is cached in the local SQLite database.

3. **On-Chain Minting.** A Solana Metaplex NFT is created on devnet using the UMI framework. The NFT's name is the strategy name (max 32 characters), symbol is `E-{strategyId.slice(0,8)}`, and the metadata URI points to an API endpoint (`/api/strategies/{id}/metadata.json`) that serves Metaplex-standard JSON with strategy attributes, 0g root hash, creation date, and author wallet. Seller fee is 0%.

4. **Owner-Only Access.** Non-owners querying the API receive strategy metadata and performance data but get empty `nodes` and `connections` arrays with no `encryptedData`. Owners receive the encrypted blob, derive the decryption key from their wallet, and decrypt client-side. The server never handles plaintext strategy logic.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5 (strict mode) |
| Frontend | React 18, Tailwind CSS 3.4, Framer Motion 12 |
| Graph Editor | @xyflow/react 12 (ReactFlow) |
| Graph Layout | @dagrejs/dagre 2.0 |
| Charts | Recharts 3.8 |
| AI | Anthropic Claude API (@anthropic-ai/sdk) — Haiku 4.5, Sonnet 4.6, Opus 4.6 |
| Market Data | Gemini Prediction Markets API, Gemini Spot API, Polymarket CLOB API |
| News Data | NewsAPI, RSS (Reuters, BBC, NYT via rss-parser) |
| Database | SQLite (better-sqlite3) |
| Blockchain | Solana (web3.js, SPL Token) |
| NFT Standard | Metaplex Token Metadata v3 (UMI) |
| Decentralized Storage | 0g Storage (@0glabs/0g-ts-sdk, ethers 6) |
| Notifications | Twilio SMS |
| Data Fetching | SWR 2.4 |
| Identifiers | UUID v13 |

---

## How to Run

```bash
git clone https://github.com/your-repo/edge.git
cd edge/oracle
npm install
```

Create `.env.local` with the following:

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...          # Claude API for AI nodes and strategy generation
NEWS_API_KEY=...                       # NewsAPI for news_monitor nodes
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Market data (defaults shown, override if needed)
GEMINI_API_BASE=https://api.gemini.com
POLYMARKET_API_BASE=https://clob.polymarket.com

# Optional: 0g Storage for encrypted strategy uploads
ZEROG_PRIVATE_KEY=...                  # 0g testnet wallet private key

# Optional: SMS alerts
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

```bash
npm run dev          # Start development server on http://localhost:3000
npm run runner       # Start background strategy execution daemon (30s polling)
npm run build        # Production build
npm start            # Production server
```

---

## Known Limitations

- **Simulation only.** All trades are paper trades. The `trade_advanced` node tracks simulated positions with P&L but does not submit orders to any exchange API. Live execution would require exchange API key integration and order management logic.

- **Backtest fidelity.** Gemini's public candle API provides a maximum of 7 days of hourly data. Backtests over longer periods extrapolate from available data. AI analysis nodes are called with cached results per event, so backtests do not capture how AI estimates would have evolved over time with different information.

- **Twitter data is simulated.** The `twitter_monitor` node generates synthetic tweet data from news articles with deterministic pseudo-random attributes. It does not call the Twitter/X API.

- **On-chain activity is proxied.** The `onchain_activity` node uses Gemini trade data as a proxy for whale transactions rather than indexing actual blockchain data.

- **Solana devnet only.** NFT minting operates on Solana devnet. Mainnet deployment requires an RPC endpoint change and real SOL for transaction fees.

- **0g testnet.** Decentralized storage uses the 0g Galileo testnet. Data persistence depends on testnet availability.

- **Single-user database.** SQLite provides sufficient performance for a single-user deployment but is not suitable for concurrent multi-user production workloads.

- **Marketplace data is seeded.** The marketplace displays static sample strategies with pre-computed performance metrics rather than live-computed metrics from user-submitted strategies.

---

## Team

**Logan Staples** — Solo builder. University of Michigan, Ross School of Business / Computer Science minor.
