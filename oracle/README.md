# Edge

A no-code platform for building, deploying, and sharing autonomous prediction market trading strategies.

## What Edge Does

Edge lets anyone build sophisticated prediction market trading strategies without writing a single line of code. Users describe their strategy in plain English, and AI generates a visual node graph representing the complete data pipeline, from ingestion through analysis, decision-making, and trade execution. Every strategy backtests against real historical market data from Gemini and Polymarket, producing auditable performance metrics including Sharpe ratio, max drawdown, and profit factor. Strategies are encrypted client-side with AES-256-GCM derived from the user's Phantom wallet, uploaded to 0G decentralized storage, and minted as Solana NFTs via Metaplex, creating verifiable on-chain provenance for proprietary alpha. Edge turns prediction market trading from an engineering problem into a creative one.

## How It Works

**1. Describe.** Type a strategy in natural language. "Monitor breaking political news, find relevant Polymarket contracts, estimate probability shifts with AI, and trade when edge exceeds 5%." Claude generates a complete node graph with correct data flow, reactive lookups, and gating logic.

**2. Backtest.** The engine fetches real historical prices from the Gemini Prediction Markets API and the Polymarket CLOB, replays your strategy tick-by-tick against that data, and streams per-tick narrations showing exactly what each node computed and why each trade was placed. The backtester calls Claude for AI nodes, caches results per event, and produces standard quantitative metrics.

**3. Own.** Encrypt your strategy with your wallet. Upload the ciphertext to 0G decentralized storage. Mint it as a Solana NFT. The encrypted blob is content-addressed by its Merkle root hash on the 0G chain. Only your wallet can derive the decryption key. Share it on the marketplace, or keep it private.

## Node Architecture

Strategies are directed acyclic graphs of atomic, composable nodes. Each node has typed input/output handles and a flat configuration object. The execution engine topologically sorts the graph and propagates a "river" -- a flat key-value map that accumulates data as it flows through each node.

### Watch Nodes (Blue, #5B7FFF) -- Data Sources

| Node | Description |
|------|-------------|
| **News Monitor** | Scans NewsAPI and RSS feeds (Reuters, BBC, NYT) with tiered source filtering and keyword matching |
| **Gemini Markets** | Streams live Gemini prediction market events with bid/ask/last prices, spread, and significant move detection |
| **Polymarket Feed** | Streams live Polymarket pricing with full CLOB order book data (bids, asks, depth) |
| **X/Twitter Monitor** | Watches Twitter for keyword and handle matches with follower count and verification filtering |
| **Crypto Price** | Tracks live cryptocurrency prices via Gemini ticker with multi-timeframe change calculation |
| **On-Chain Activity** | Monitors blockchain transactions and whale alerts across Bitcoin, Ethereum, and Solana |
| **Calendar/Timer** | Fires on interval, scheduled time, or one-shot triggers with day-of-week filtering |
| **Strategy Link** | Reads live output (signal, edge, PnL, position) from another deployed strategy |

### Think Nodes (Purple, #A855F7) -- AI and Analysis

| Node | Description |
|------|-------------|
| **AI Analyst** | LLM-powered analysis via Claude with configurable depth (fast/balanced/thorough) and structured probability output |
| **Sentiment Scanner** | High-throughput text sentiment classification with domain-specific scoring |
| **Consensus** | Merges 2-5 probability inputs via weighted average or majority vote with disagreement detection |
| **History Tracker** | Tracks value trends, momentum, streaks, and rate of change over configurable time windows |
| **Formula** | Evaluates custom math expressions on numerical inputs from the river |

### Decide Nodes (Amber, #F59E0B) -- Logic and Control

| Node | Description |
|------|-------------|
| **Edge Calculator** | Computes the full 9-stage confidence scoring and edge framework (see Section 5); gates on minimum edge threshold |
| **Arb Detector** | Detects cross-platform price discrepancies between Gemini and Polymarket, net of fees |
| **Router** | Conditional branching on any river field with up to 4 output routes |
| **Price Alert** | Triggers when market price crosses a threshold (rises above, drops below, crosses either) |
| **Cooldown Gate** | Rate-limits execution with configurable period, max triggers, and direction-aware reset |
| **Multi-Gate** | AND/OR/Majority gate across 2-4 inputs with optional timeout |

### Act Nodes (Green, #00D26A) -- Actions

| Node | Description |
|------|-------------|
| **Trade** | Full-featured trade execution with platform auto-selection, limit orders, position management, and auto-close |
| **Alert** | Multi-channel notifications (in-app, SMS, Discord, email) with template variables |
| **Strategy Command** | Sends commands (pause, resume, signal, adjust sizing) to another deployed strategy |

Data sources with no incoming connections are standalone entry points. Data sources with incoming connections are **reactive** -- upstream `search_terms` override their static config, enabling patterns like `News Monitor -> AI Analyst -> Polymarket Feed` where the AI determines what markets to search for.

## Gemini Prediction Markets API Integration

The Gemini Prediction Markets API is the core data layer for Edge. Every strategy that touches prediction markets queries Gemini for event discovery, real-time pricing, and historical candle data. The integration spans four API surfaces:

### API Endpoint Usage

| Gemini API Endpoint | Method | Location in Codebase | Exact Usage |
|---|---|---|---|
| `GET /v1/prediction-markets/events` | REST | `src/lib/data/gemini.ts:fetchGeminiEvents()` | Queries active prediction market events with filtering by `category`, `status[]`, `search` keyword, and pagination (`limit`, `offset`). Returns typed `GeminiEventResponse` with event objects containing contracts, prices (bestBid, bestAsk, lastTradePrice, buy.yes, buy.no, sell.yes, sell.no), category, expiry, volume, and liquidity. Called with `status: ["active"]` for live market discovery. |
| `GET /v1/prediction-markets/categories` | REST | `src/lib/data/gemini.ts:fetchGeminiCategories()` | Retrieves the list of available prediction market categories for category-based filtering in the Gemini Markets Feed node and marketplace UI. |
| `GET /v2/ticker/{symbol}` | REST | `src/lib/data/gemini.ts:fetchGeminiTicker()` | Fetches real-time ticker data for a specific instrument symbol. Returns bid, ask, open, high, low, close, and changes array. Used in two critical paths: (1) the **Crypto Price node** (`src/lib/engine/node-runners/data-sources.ts:runCryptoPrice()`) fetches `GET /v2/ticker/{pair}` (e.g., `btcusd`, `ethusd`) for live price, 24h high/low, and volume; (2) the **paper trader** (`src/lib/engine/paper-trader.ts:processTrades()`) calls `fetchGeminiTicker(instrumentSymbol)` to get real-time bid price for trade entry pricing on Gemini-platform trades. |
| `GET /v2/candles/{symbol}/{timeframe}` | REST | `src/lib/engine/node-runners/data-sources.ts:runCryptoPrice()` | Fetches candlestick data at intervals `1m`, `5m`, `15m`, `1hr`, `6hr`, `1day`. Each candle is `[timestamp_ms, open, high, low, close, volume]`. The Crypto Price node uses this to compute accurate price change percentages over the user's configured timeframe by comparing the current close against the prior candle's open. |
| `GET /v2/candles/{symbol}/1hr` | REST | `src/lib/engine/backtester.ts:fetchGeminiHistory()` | The backtester fetches hourly candles for Gemini prediction market instrument symbols to reconstruct historical price series. Each hourly candle is expanded into 4 sub-points at 0, 15, 30, and 45 minutes (open, high, low, close respectively) to capture intra-hour price movement and prevent illiquid markets from producing flat interpolated prices that would zero out P&L. |
| `GET /v1/trades/{pair}` | REST | `src/lib/engine/node-runners/data-sources.ts:runOnChainActivity()` | Fetches recent trades for crypto pairs (`btcusd`, `ethusd`, `solusd`) with `limit_trades` parameter. The On-Chain Activity node uses Gemini trade data as a high-fidelity proxy for large-value blockchain transactions, mapping each trade to a whale alert with computed dollar value, deterministic transaction hash, and chain attribution. |
| `GET /v1/prediction-markets/events` (paginated) | REST | `src/lib/data/gemini.ts:fetchAllActiveGeminiEvents()` | Exhaustive pagination loop that fetches ALL active Gemini prediction market events by incrementing `offset` by `limit=100` until `offset >= total`. Used by the **Gemini Markets Feed node** (`src/lib/engine/node-runners/data-sources.ts:runGeminiMarketsFeed()`) and the **backtester** for market discovery. |

### Data Flow Through the System

When a Gemini Markets Feed node executes, the runner calls `fetchAllActiveGeminiEvents()`, filters events by the node's `event_search`, `watch_mode`, and `category` config, then extracts contract-level pricing using `getImpliedProbability()`. This function implements a price waterfall: it first tries `lastTradePrice`, falls back to `(bestBid + bestAsk) / 2` midpoint, then to `buy.yes`, and finally defaults to `0.5`. The extracted probability becomes the `contract_price` field in the river, which downstream nodes (AI Analyst, Edge Calculator) consume as the market-implied probability.

The Gemini ticker API also powers the Crypto Price node's multi-timeframe analysis. For timeframes shorter than 24 hours, the node makes a second call to the candles endpoint to compute an accurate change percentage against the correct reference candle, rather than relying on the 24h open from the ticker.

During backtesting, the engine calls `fetchGeminiHistory()` for every matched Gemini event, which hits the hourly candles endpoint for each instrument symbol. The OHLC expansion from 1 candle to 4 sub-points is critical for backtest realism -- without it, prediction markets that trade infrequently produce degenerate price series where every tick has the same interpolated value, making edge computation meaningless.

Gemini contract data flows into the Edge Calculator as `marketProbability`, where it is compared against the AI's calibrated probability estimate to compute effective edge, Kelly fraction, and expected value. The full contract pricing structure (bestBid, bestAsk, lastTradePrice, buy/sell yes/no) is preserved in the river, enabling downstream nodes to access spread, liquidity, and directional pressure signals.

## Confidence Scoring and Edge Computation Framework

The Edge Calculator implements a 9-stage scoring pipeline that transforms raw AI probability estimates and market data into calibrated, risk-adjusted trading signals. The full implementation is in `src/lib/engine/edge.ts`. This section documents the mathematical framework as implemented in code.

### Stage 1: Beta Distribution Modeling

The AI's point estimate p-hat is modeled as the mean of a Beta(alpha, beta) distribution to capture epistemic uncertainty. The concentration parameter kappa = alpha + beta encodes the AI's self-assessed confidence level:

```
alpha = p-hat * kappa
beta  = (1 - p-hat) * kappa

kappa values:
  low confidence:    kappa = 8   -> std ~ 0.16
  medium confidence: kappa = 20  -> std ~ 0.10
  high confidence:   kappa = 50  -> std ~ 0.06

Var[X] = (alpha * beta) / ((alpha + beta)^2 * (alpha + beta + 1))
```

This is superior to treating the AI output as a point estimate because it provides a principled uncertainty band. A "high confidence" estimate of 0.70 has alpha=35, beta=15, std=0.064, meaning the 95% credible interval is approximately [0.57, 0.83]. A "low confidence" estimate of 0.70 has alpha=5.6, beta=2.4, std=0.153, meaning the 95% interval is approximately [0.39, 1.00].

### Stage 2: Platt Scaling Calibration

LLM probability estimates exhibit non-linear overconfidence that worsens at the extremes. Standard linear shrinkage (p_cal = lambda*p + (1-lambda)*0.5) compresses uniformly, which is suboptimal. Edge applies Platt scaling in log-odds space:

```
p_cal = sigmoid(a * logit(p-hat) + b)

where:
  logit(p) = ln(p / (1 - p))
  sigmoid(x) = 1 / (1 + exp(-x))
  a = 0.82  (slope < 1 compresses extremes)
  b = 0.0   (no systematic directional bias)
```

Calibration examples from the implementation:
- p = 0.50 -> logit = 0.00 -> cal = sigmoid(0.00) = 0.500 (unchanged at center)
- p = 0.90 -> logit = 2.20 -> cal = sigmoid(1.80) = 0.858 (pulled inward 4.2pp)
- p = 0.95 -> logit = 2.94 -> cal = sigmoid(2.41) = 0.918 (pulled inward 3.2pp)
- p = 0.10 -> logit = -2.20 -> cal = sigmoid(-1.80) = 0.142 (symmetric pull)

### Stage 3: Orderbook Microstructure Analysis

When Polymarket CLOB order book data is available (fetched via `fetchPolymarketOrderBook`), the system extracts microstructure signals (`src/lib/engine/orderbook.ts`):

- **Effective spread**: bestAsk - bestBid
- **Spread percentage**: effectiveSpread / midpoint
- **Depth imbalance**: (bidDepth - askDepth) / (bidDepth + askDepth), computed over top 10 price levels on each side, weighted by price * size to get USD-equivalent depth. Range [-1, 1] where positive indicates buying pressure.
- **VWAP slippage**: walks the order book to compute volume-weighted average price for a hypothetical order of configurable size (default $25). Slippage = average of buy-side and sell-side price impact as fraction of midpoint.
- **Market efficiency**: composite score = 0.40 * spreadScore + 0.35 * depthScore + 0.25 * balanceScore, where spreadScore = 1/(1 + 50*spreadPct), depthScore = sigmoid(log10(totalDepth), 3.5, 1.5), balanceScore = 1 - |depthImbalance|.

When order book data is unavailable, the system estimates slippage as half the spread and estimates efficiency from spread tightness and volume.

### Stage 4: Information-Theoretic Divergence

Three metrics quantify the AI-vs-market disagreement:

**KL Divergence** (Bernoulli): Measures information lost when using the market distribution to approximate the AI distribution.
```
KL(AI || Market) = p * ln(p/q) + (1-p) * ln((1-p)/(1-q))
```
Unlike raw edge, KL is scale-aware: a 5% disagreement at 50% (KL=0.005) is different from 5% at 95% (KL=0.058).

**Shannon Entropy**: H(p) = -p*ln(p) - (1-p)*ln(1-p). Maximum at p=0.5 (H=0.693 nats). Low entropy means the AI is confident in its estimate.

**Information Ratio**: |calibratedAI - market| / aiStdDev. This is a quasi-Sharpe ratio measuring edge per unit of uncertainty. Used in signal classification.

### Stage 5: Multi-Factor Confidence Aggregation

Nine orthogonal factors, each normalized to [0, 1], are combined via weighted sum:

| Factor | Weight | Computation |
|--------|--------|-------------|
| AI Confidence | 0.20 | Maps low/medium/high to 0.30/0.60/0.90 |
| Source Corroboration | 0.10 | sigmoid(sourceCount, midpoint=3, steepness=1.2); saturates at ~5 sources |
| Reasoning Depth | 0.08 | min(1, keyFactorCount / 7) |
| Liquidity Quality | 0.15 | From orderbook: 0.6 * spreadScore + 0.4 * depthScore. Fallback: 0.6 * (1/(1+40*spread)) + 0.4 * sigmoid(log10(volume), log10(5000), 1) |
| Temporal Freshness | 0.10 | exp(-0.1733 * newsAgeHours); half-life = 4 hours. At 0h: 1.0, 4h: 0.5, 8h: 0.25, 24h: 0.015 |
| Extremity Penalty | 0.07 | 4 * p_cal * (1 - p_cal); peaks at 0.5 (=1.0), drops to 0 at extremes |
| Sentiment Alignment | 0.10 | 0.5 + 0.5 * tanh(edgeDirection * sentimentScore * 5); rewards agreement between sentiment and edge direction |
| Orderbook Confirmation | 0.10 | 0.5 + 0.5 * tanh(edgeDirection * depthImbalance * 3); rewards agreement between book pressure and edge direction |
| Market Efficiency Adj. | 0.10 | 1 - marketEfficiency; penalizes efficient markets where edge is harder to sustain |

Weights sum to 1.00. The composite confidence C is the dot product of factor values and weights.

### Stage 6: Effective Edge

The calibrated edge is adjusted for confidence, execution cost, and market efficiency:

```
E_cal = calibratedAI - marketProbability
E_eff = E_cal * C * (1 - slippage) * (1 - eta * marketEfficiency)

where:
  C = composite confidence from Stage 5
  slippage = estimated execution cost from Stage 3
  eta = 0.3 (efficiency discount factor)
```

The system also computes edge in log-odds space: logOddsEdge = logit(calAI) - logit(market), which normalizes for the fact that probability differences are not equally meaningful across the [0, 1] range.

### Stage 7: Kelly Criterion with Drawdown Constraint

For a binary prediction market where buying YES at price m pays $1 if the event occurs:

```
Payout odds: b = (1 - m) / m
Kelly fraction: f* = (b * p - q) / b    where p = calibrated probability, q = 1 - p

Three safety modifications:
  1. Half-Kelly:        f *= 0.5
  2. Confidence scaling: f *= compositeConfidence
  3. Drawdown cap:      f = min(f, 0.15, 0.05)

Suggested size = kellyFraction * bankroll (default $1,000)
```

If the AI estimates the event is less likely than the market (calAI < market), the system bets NO with odds b = m / (1 - m) and true probability q.

### Stage 8: Expected Value Framework

For a YES trade at market price m with AI probability p and position size S:

```
E[gain] = p * (1 - m) * S
E[loss] = (1 - p) * m * S
E[value] = E[gain] - E[loss]
Risk/Reward = E[gain] / E[loss]

EVPI = E[V|perfect information] - max(E[V|current bet], 0)
     = [p * (1-m) * S + (1-p) * m * S] - max(E[value], 0)
```

EVPI (Expected Value of Perfect Information) quantifies the value of resolving remaining uncertainty before trading. A high EVPI relative to expected value suggests gathering more information before committing capital.

### Stage 9: Signal Classification

Signals are classified by convergence of three axes:

| Signal | Effective Edge | Confidence | Information Ratio |
|--------|---------------|------------|-------------------|
| **Strong** | > 6% | > 0.60 | > 0.50 |
| **Moderate** | > 3% | > 0.40 | > 0.25 |
| **Weak** | > 1% | > 0.25 | any |
| **None** | otherwise | | |

### Worked Example

Consider a political prediction market: "Will Candidate X win the election?" The market prices YES at 0.55. The AI estimates probability 0.78 with high confidence, based on 4 corroborating news sources and 5 key reasoning factors. News is 2 hours old. Sentiment score is +0.6. No order book data available. Spread is 0.03, volume is $50,000.

**Stage 1**: kappa = 50 (high confidence). alpha = 0.78 * 50 = 39. beta = 0.22 * 50 = 11. aiStdDev = sqrt(39 * 11 / (50^2 * 51)) = 0.058.

**Stage 2**: logit(0.78) = ln(0.78/0.22) = 1.266. Platt scaled: sigmoid(0.82 * 1.266 + 0) = sigmoid(1.038) = 0.738.

**Stage 3**: No orderbook. slippage = 0.03/2 = 0.015. spreadScore = 1/(1+50*0.03) = 0.400. volScore = sigmoid(log10(50000), log10(5000), 1) = sigmoid(4.699, 3.699, 1) = 0.731. marketEfficiency = 0.5 * 0.400 + 0.5 * 0.731 = 0.566.

**Stage 4**: KL(0.738 || 0.55) = 0.738 * ln(0.738/0.55) + 0.262 * ln(0.262/0.45) = 0.073 nats. Shannon entropy H(0.738) = 0.589 nats. Information ratio = |0.738 - 0.55| / 0.058 = 3.24.

**Stage 5**:
- aiConfidence = 0.90 (high)
- sourceCorroboration = sigmoid(4, 3, 1.2) = 0.769
- reasoningDepth = min(1, 5/7) = 0.714
- liquidityQuality = 0.6 * (1/(1+40*0.03)) + 0.4 * sigmoid(log10(50000), log10(5000), 1) = 0.6 * 0.455 + 0.4 * 0.731 = 0.565
- temporalFreshness = exp(-0.1733 * 2) = 0.707
- extremityPenalty = 4 * 0.738 * 0.262 = 0.773
- sentimentAlignment = 0.5 + 0.5 * tanh((0.738-0.55) * 0.6 * 5) = 0.5 + 0.5 * tanh(0.564) = 0.5 + 0.5 * 0.511 = 0.756
- orderBookConfirmation = 0.50 (no data, neutral)
- marketEfficiencyAdj = 1 - 0.566 = 0.434

Composite C = 0.20(0.90) + 0.10(0.769) + 0.08(0.714) + 0.15(0.565) + 0.10(0.707) + 0.07(0.773) + 0.10(0.756) + 0.10(0.50) + 0.10(0.434) = **0.688**

**Stage 6**: E_cal = 0.738 - 0.55 = 0.188. E_eff = 0.188 * 0.688 * (1 - 0.015) * (1 - 0.3 * 0.566) = 0.188 * 0.688 * 0.985 * 0.830 = **0.106** (10.6% effective edge).

**Stage 7**: b = (1 - 0.55)/0.55 = 0.818. f* = (0.818 * 0.738 - 0.262)/0.818 = 0.418. f_safe = min(0.418 * 0.5 * 0.688, 0.15, 0.05) = min(0.144, 0.15, 0.05) = **0.05**. Suggested size = 0.05 * $1,000 = **$50.00**.

**Stage 8**: E[gain] = 0.738 * 0.45 * 50 = $16.61. E[loss] = 0.262 * 0.55 * 50 = $7.21. E[value] = $9.40. Risk/Reward = 2.30. EVPI = ($16.61 + $7.21) - $9.40 = $14.42.

**Stage 9**: |E_eff| = 0.106 > 0.06, C = 0.688 > 0.60, IR = 3.24 > 0.50. Signal: **Strong**.

## Data Ingestion Strategy

Edge consumes data from six source categories, each implemented as a node runner in `src/lib/engine/node-runners/data-sources.ts`:

**News**: NewsAPI headlines endpoint (`/v2/top-headlines`) rotates across business, technology, science, and politics categories. The `/v2/everything` endpoint supports historical keyword search with date ranges for backtesting. Three RSS feeds (Reuters, BBC News, NY Times) provide supplementary coverage. Articles are deduplicated by title similarity via `src/lib/utils/dedup.ts` and stored in SQLite. Source tiering classifies outlets into tier 1 (Reuters, AP, Bloomberg, WSJ), tier 2 (CNN, BBC, CNBC, NYT, Guardian, FT), and tier 3 (everything else).

**Prediction Markets**: Gemini prediction market events via `/v1/prediction-markets/events` with full contract pricing. Polymarket CLOB markets via `/sampling-markets` with order book depth via `/book?token_id=`. Both platforms support paginated discovery, keyword filtering, and category filtering.

**Cryptocurrency**: Gemini ticker and candle APIs provide real-time and historical crypto pricing for any traded pair.

**Social**: Twitter/X content monitoring with keyword matching, handle tracking, follower count thresholds, verified-only filtering, retweet exclusion, and language filtering.

**On-Chain**: Whale alert detection using Gemini trade data as a proxy for large-value transactions across Bitcoin, Ethereum, and Solana chains, with configurable minimum dollar value thresholds.

**Temporal**: Calendar/timer triggers supporting fixed-interval (30s to 24h), scheduled-time (with day-of-week filtering), and one-shot modes.

## Marketplace and Strategy NFTs

The marketplace (`src/app/marketplace/page.tsx`) displays published strategies with full performance metrics: total return, win rate, Sharpe ratio, max drawdown, average edge, and equity curves. Strategies are categorized (Crypto, Politics, Economics, Sports, Multi-Market, Arbitrage) and sortable by performance, clone count, recency, or win rate.

**Cloning**: Any public strategy can be cloned into the user's workspace via the `/api/marketplace/[id]/clone` endpoint, which copies the full node graph and connections.

**Encryption**: Strategy data (nodes + connections) is encrypted client-side using AES-256-GCM (`src/lib/encryption/strategy-cipher.ts`). The encryption key is derived deterministically: the user's Phantom wallet signs a fixed message ("Edge Strategy Encryption Key v1"), the ed25519 signature is SHA-256 hashed to produce a 256-bit key. Because ed25519 signatures are deterministic, the same wallet always produces the same key with no key storage required.

**Decentralized Storage**: Encrypted strategy blobs are uploaded to 0G (Zero Gravity) decentralized storage (`src/lib/storage/zg-client.ts`). The system creates a Merkle tree of the encrypted file, uploads via the 0G indexer, and returns a content-addressed root hash. Downloads retrieve by root hash. The system gracefully degrades if 0G is not configured, caching encrypted data in the local database.

**NFT Minting**: Strategies are minted as Solana NFTs via Metaplex (`src/lib/nft/mint.ts`). Each NFT carries the strategy name (truncated to 32 chars), a symbol derived from the strategy ID, a URI pointing to an on-chain metadata.json endpoint, and the creator's wallet as verified creator with 100% share.

**Payment Streaming**: Strategy execution is billed via streaming USDC micropayments (`src/lib/payments/streams.ts`). Each execution tick costs $0.001 USDC; backtest ticks cost $0.0005 USDC. Streams can be paused, resumed, or stopped. Minimum wallet balance to start a stream is $0.50 USDC.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2 (App Router) |
| Language | TypeScript 5 |
| UI | React 18, Tailwind CSS 3.4, Framer Motion |
| Node Graph | @xyflow/react (React Flow) with dagre auto-layout |
| Charts | Recharts |
| AI | Anthropic Claude API (@anthropic-ai/sdk) -- Claude Haiku 4.5 for analysis, event extraction, market matching, and strategy generation |
| Database | better-sqlite3 (embedded, zero-config) |
| Prediction Markets | Gemini Prediction Markets API, Polymarket CLOB API |
| News | NewsAPI, RSS (rss-parser) |
| Blockchain | Solana Web3.js, SPL Token, Metaplex UMI + mpl-token-metadata |
| Decentralized Storage | 0G TS SDK (@0glabs/0g-ts-sdk) with ethers.js for chain interaction |
| Data Fetching | SWR |
| Payments | Solana USDC streaming micropayments |

## How to Run

```bash
# Clone and install
git clone <repo-url> && cd oracle
npm install

# Configure environment
cp .env.example .env.local
# Required:
#   ANTHROPIC_API_KEY        -- Claude API key for AI nodes and strategy generation
# Optional:
#   NEWS_API_KEY             -- NewsAPI.org key for news ingestion
#   GEMINI_API_BASE          -- Gemini API base URL (defaults to https://api.gemini.com)
#   POLYMARKET_API_BASE      -- Polymarket CLOB base URL (defaults to https://clob.polymarket.com)
#   NEXT_PUBLIC_SOLANA_RPC_URL -- Solana RPC (defaults to devnet)
#   ZEROG_PRIVATE_KEY        -- EVM private key for 0G storage uploads
#   ZEROG_EVM_RPC            -- 0G chain RPC (defaults to testnet)
#   ZEROG_INDEXER_RPC        -- 0G storage indexer (defaults to testnet)
#   ZEROG_FLOW_ADDRESS       -- 0G flow contract address (defaults to testnet)

# Run development server
npm run dev

# Run the autonomous strategy execution daemon (separate terminal)
npm run runner
```

The application runs at `http://localhost:3000`. The SQLite database is created automatically on first request. No external database setup is required.

## Known Limitations

- **Paper trading only.** All trades are simulated. The Trade node does not execute real orders on Gemini or Polymarket. Live execution would require authenticated API access and order placement logic.
- **Twitter data is simulated.** The Twitter Monitor node uses news articles as a proxy for tweet content due to Twitter API authentication requirements. The filtering logic (keywords, follower thresholds, verification) is fully implemented against this proxy data.
- **Backtest lookback is bounded.** Gemini candle API returns at most 7 days of hourly data. Polymarket history depends on market age. The "1 month" backtest period interpolates within available data.
- **AI caching is per-session.** Claude analysis results are cached per event during a backtest run but not persisted across sessions. Repeated backtests of the same strategy re-invoke Claude.
- **Single-user local database.** SQLite is embedded and local. There is no multi-user authentication, no cloud persistence, and no concurrent write safety beyond SQLite's built-in locking.
- **0G storage requires testnet tokens.** Uploading encrypted strategies to 0G requires gas on the 0G testnet chain. Without `ZEROG_PRIVATE_KEY`, the system falls back to local-only encrypted storage.
- **NFT minting is on Solana devnet.** The Metaplex integration targets devnet by default. Mainnet deployment would require changing the RPC URL and funding the wallet with real SOL.

## Team

**Logan Staples** -- Solo builder. University of Michigan, Ross School of Business / Computer Science minor.

Built in 36 hours at PennApps 2026.
