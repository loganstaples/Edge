# ORACLE — AI-Powered Prediction Market Terminal

> One AI-powered terminal for all prediction markets. Where markets exist, it helps you trade them. Where they don't, it creates them.

ORACLE is an AI system that reads breaking news, generates probability estimates for real-world events, computes edge against existing prediction markets (Gemini + Polymarket), and creates its own prediction markets on Solana for events the market hasn't priced yet.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ORACLE DASHBOARD                         │
│                     (Next.js + React)                         │
│                                                               │
│  ┌──────────┐  ┌──────────────────┐  ┌────────────────────┐  │
│  │ News Feed │  │  Market Grid      │  │ Reasoning Panel   │  │
│  │ + AI      │  │  (Gemini + Poly   │  │ (why AI thinks    │  │
│  │ Annotations│ │   + Solana)       │  │  what it thinks)  │  │
│  └──────────┘  └──────────────────┘  └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Calibration Bar — AI accuracy vs market consensus         │ │
│  └──────────────────────────────────────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐
    │ AI Engine │    │ Market    │    │ Solana    │
    │ (Claude + │    │ Adapters  │    │ Program   │
    │  News     │    │ (Gemini + │    │ (Anchor   │
    │  Pipeline)│    │  Poly)    │    │  AMM)     │
    └───────────┘    └───────────┘    └───────────┘
```

## Gemini API Integration

ORACLE uses multiple Gemini Prediction Markets API endpoints:

| Endpoint | Usage |
|----------|-------|
| `GET /v1/prediction-markets/events` | Fetch all active prediction market events with contract details |
| `GET /v1/prediction-markets/events?category={cat}` | Filter events by category (crypto, sports, politics, economics) |
| `GET /v1/prediction-markets/categories` | Discover available market categories |
| `GET /v2/ticker/{instrumentSymbol}` | Live bid/ask pricing for individual contracts |

Contract prices (0–1) are interpreted as implied probabilities. The AI compares its own probability estimates against these prices to compute "edge" — the divergence between AI and market consensus.

## Solana Prediction Market

For events with no existing market, ORACLE creates binary prediction markets on Solana (devnet):

- **Mechanism:** Constant-product AMM (x * y = k) where pool ratios encode implied probabilities
- **Market Creation:** AI agent autonomously creates markets when it detects newsworthy events unpriced by existing platforms
- **Resolution:** Authority (AI agent) resolves markets based on verified outcomes
- **Trading:** Users connect Phantom wallet and trade YES/NO shares directly in the dashboard

**Program ID:** `ACfQpgaUYUuwBtsAYjKT8d3sCoELR2PzSyuwGc3RBSPf` (devnet)

## Edge Computation

```
edge = AI_probability - market_implied_probability

Signal Strength:
  |edge| > 15% AND high confidence  → STRONG
  |edge| > 10% AND medium+ confidence → MODERATE
  |edge| > 5%                        → WEAK
  |edge| ≤ 5%                        → NONE (fairly priced)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, TypeScript, Tailwind CSS |
| AI/LLM | Anthropic Claude API (Sonnet) |
| News | NewsAPI.org + RSS feeds (Reuters, BBC, NYT) |
| Markets | Gemini REST API, Polymarket REST API |
| Blockchain | Solana (Anchor/Rust), @solana/web3.js |
| Database | SQLite (better-sqlite3) |
| Charts | Recharts, custom SVG sparklines |

## Setup

### Prerequisites
- Node.js >= 20
- Rust + Cargo
- Solana CLI
- Anchor CLI

### Installation

```bash
cd oracle
npm install

# Create .env.local with:
ANTHROPIC_API_KEY=your-key
NEWS_API_KEY=your-newsapi-key
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=ACfQpgaUYUuwBtsAYjKT8d3sCoELR2PzSyuwGc3RBSPf

# Seed demo data
npx tsx -r tsconfig-paths/register scripts/seed-demo.ts

# Run
npm run dev
```

Open http://localhost:3000

### Solana Program (optional rebuild)

```bash
cd anchor
anchor build
anchor deploy --provider.cluster devnet
```

## Known Limitations

- News ingestion rate-limited by NewsAPI free tier (100 req/day)
- Solana trading is devnet-only (no real funds)
- AI probability estimates are illustrative, not financial advice
- Polymarket integration is read-only (no trade execution)

## Team

- Logan Staples — Solo developer

## Short Description

ORACLE is an AI-powered prediction market terminal that reads breaking news, estimates event probabilities using Claude, computes edge against Gemini and Polymarket prices, and creates its own prediction markets on Solana for events no market has priced yet. One terminal for all prediction markets.
