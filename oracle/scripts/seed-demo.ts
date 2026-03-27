/**
 * Seed the database with realistic demo data.
 * Run: npx tsx -r tsconfig-paths/register scripts/seed-demo.ts
 */
import { initializeDatabase } from "../src/lib/db/schema";
import { insertArticle, insertPrediction, insertMarketMatch, insertPriceHistory, markArticleProcessed } from "../src/lib/db/queries";

initializeDatabase();

const articles = [
  {
    title: "Fed Governor Waller signals rate cut 'on the table' for July meeting",
    description: "Federal Reserve Governor Christopher Waller said a rate cut could come as early as the July FOMC meeting if inflation data continues to cool.",
    source: "Reuters",
    publishedAt: new Date(Date.now() - 2 * 60000).toISOString(),
    category: "business",
    events: [
      {
        eventTitle: "Will the Federal Reserve cut interest rates at the July 2026 FOMC meeting?",
        category: "economics" as const,
        aiProbability: 0.71,
        confidence: "high" as const,
        resolutionDate: "2026-07-30",
        reasoning: "Recent CPI data shows inflation cooling faster than expected. Multiple Fed governors have signaled openness to cuts. However, labor market remains tight, introducing uncertainty.",
        keyFactors: ["CPI trending down 3 consecutive months", "Fed governor dovish statements", "Labor market still tight", "Housing inflation sticky", "Election year political pressure"],
        newsSources: ["Reuters: Fed Governor Waller signals rate cut", "Bloomberg: CPI falls to 2.3%"],
        platforms: [
          { platform: "gemini" as const, externalId: "gem-fed-jul-2026", marketPrice: 0.62, instrumentSymbol: "GEMI-FEDJUL26-DN25" },
          { platform: "polymarket" as const, externalId: "poly-fed-jul", marketPrice: 0.64, tokenId: "tok-123" },
        ],
      },
    ],
  },
  {
    title: "UK Prime Minister faces leadership challenge from within party",
    description: "Senior backbenchers in the ruling party have submitted letters of no confidence.",
    source: "BBC News",
    publishedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    category: "politics",
    events: [
      {
        eventTitle: "Will the UK Prime Minister face a no-confidence vote by Q3 2026?",
        category: "politics" as const,
        aiProbability: 0.34,
        confidence: "medium" as const,
        resolutionDate: "2026-09-30",
        reasoning: "While letters are accumulating, the threshold hasn't been reached. Historical precedent shows many challenges fizzle out.",
        keyFactors: ["Letter count approaching threshold", "Historical no-confidence vote frequency", "Party whip counter-campaign", "Polling numbers declining", "Local election results pending"],
        newsSources: ["BBC: UK PM leadership challenge", "Guardian: Backbench rebellion grows"],
        platforms: [],
      },
    ],
  },
  {
    title: "Bitcoin surges past $150K as institutional demand hits new high",
    description: "Bitcoin hit a new all-time high of $152,000 as BlackRock's spot ETF recorded its largest single-day inflow.",
    source: "CoinDesk",
    publishedAt: new Date(Date.now() - 8 * 60000).toISOString(),
    category: "technology",
    events: [
      {
        eventTitle: "Will Bitcoin reach $200,000 before January 2027?",
        category: "crypto" as const,
        aiProbability: 0.42,
        confidence: "medium" as const,
        resolutionDate: "2027-01-01",
        reasoning: "Current momentum is strong with ETF inflows, but $200K represents a significant barrier. Historical cycles suggest a cooling period.",
        keyFactors: ["ETF inflow acceleration", "Halving cycle dynamics", "Macro liquidity conditions", "Regulatory clarity improving", "Institutional adoption curve"],
        newsSources: ["CoinDesk: BTC surges past $150K", "Bloomberg: BlackRock ETF record inflow"],
        platforms: [
          { platform: "gemini" as const, externalId: "gem-btc-200k", marketPrice: 0.38, instrumentSymbol: "GEMI-BTC200K-UP" },
        ],
      },
    ],
  },
  {
    title: "EU announces landmark AI regulation framework with strict compliance deadlines",
    description: "The European Commission unveiled detailed implementation rules for the AI Act.",
    source: "NY Times",
    publishedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    category: "technology",
    events: [
      {
        eventTitle: "Will the EU AI Act certification deadline be extended beyond March 2027?",
        category: "technology" as const,
        aiProbability: 0.55,
        confidence: "medium" as const,
        resolutionDate: "2027-03-31",
        reasoning: "Major tech companies have lobbied for extensions. However, the EU has shown resolve in maintaining its regulatory timelines.",
        keyFactors: ["Industry lobbying pressure", "EU historical precedent on deadlines", "Technical implementation complexity", "Political will in EU Parliament", "US regulatory competition"],
        newsSources: ["NY Times: EU AI regulation", "Financial Times: Tech companies seek delay"],
        platforms: [],
      },
    ],
  },
  {
    title: "SpaceX Starship successfully completes orbital refueling test",
    description: "SpaceX achieved a major milestone by demonstrating fuel transfer between two Starship vehicles in orbit.",
    source: "Reuters",
    publishedAt: new Date(Date.now() - 45 * 60000).toISOString(),
    category: "science",
    events: [
      {
        eventTitle: "Will NASA's Artemis III mission launch before December 2027?",
        category: "science" as const,
        aiProbability: 0.28,
        confidence: "low" as const,
        resolutionDate: "2027-12-31",
        reasoning: "The refueling test is a major milestone, but numerous technical challenges remain. NASA missions historically face significant delays.",
        keyFactors: ["Orbital refueling milestone achieved", "Remaining technical hurdles", "NASA mission delay history", "Congressional budget allocation", "International partner readiness"],
        newsSources: ["Reuters: SpaceX orbital refueling", "NASA: Artemis III timeline update"],
        platforms: [
          { platform: "polymarket" as const, externalId: "poly-artemis-2027", marketPrice: 0.22, tokenId: "tok-456" },
        ],
      },
    ],
  },
];

const noEventArticles = [
  { title: "Tech stocks rally on earnings beat across sector", source: "AP News", publishedAt: new Date(Date.now() - 12 * 60000).toISOString(), category: "business" },
  { title: "Global supply chain improvements continue in Q1 data", source: "Reuters", publishedAt: new Date(Date.now() - 25 * 60000).toISOString(), category: "business" },
  { title: "New study reveals ocean temperatures rising faster than predicted", source: "BBC News", publishedAt: new Date(Date.now() - 50 * 60000).toISOString(), category: "science" },
  { title: "Major cybersecurity breach affects 10 million users at healthcare provider", source: "NY Times", publishedAt: new Date(Date.now() - 60 * 60000).toISOString(), category: "technology" },
  { title: "Champions League quarterfinal draw produces exciting matchups", source: "BBC Sport", publishedAt: new Date(Date.now() - 90 * 60000).toISOString(), category: "sports" },
];

console.log("Seeding articles with events...");

for (const data of articles) {
  const articleId = insertArticle({
    title: data.title,
    description: data.description,
    source: data.source,
    url: null,
    publishedAt: data.publishedAt,
    category: data.category,
  });

  let matchCount = 0;
  let bestEdge: string | null = null;
  let bestEdgeRaw = 0;

  for (const event of data.events) {
    const predId = insertPrediction({
      articleId,
      eventTitle: event.eventTitle,
      category: event.category,
      aiProbability: event.aiProbability,
      confidence: event.confidence,
      resolutionDate: event.resolutionDate,
      reasoning: event.reasoning,
      keyFactors: event.keyFactors,
      newsSources: event.newsSources,
    });

    for (const plat of event.platforms) {
      const edge = event.aiProbability - plat.marketPrice;
      const absEdge = Math.abs(edge);
      const signal = absEdge > 0.15 ? "strong" : absEdge > 0.10 ? "moderate" : absEdge > 0.05 ? "weak" : "none";

      insertMarketMatch({
        predictionId: predId,
        platform: plat.platform,
        externalId: plat.externalId,
        instrumentSymbol: (plat as any).instrumentSymbol,
        tokenId: (plat as any).tokenId,
        marketPrice: plat.marketPrice,
        edge,
        signalStrength: signal,
      });

      for (let i = 10; i >= 0; i--) {
        const histPrice = plat.marketPrice + (Math.random() - 0.5) * 0.06;
        insertPriceHistory(predId, plat.platform, histPrice, event.aiProbability);
      }

      matchCount++;
      if (absEdge > bestEdgeRaw) {
        bestEdgeRaw = absEdge;
        bestEdge = `${edge >= 0 ? "+" : ""}${(edge * 100).toFixed(0)}%`;
      }
    }
  }

  const tag = matchCount > 0 ? "event_detected" : "event_detected";
  markArticleProcessed(articleId, tag, matchCount, bestEdge);
}

console.log("Seeding no-event articles...");

for (const data of noEventArticles) {
  const id = insertArticle({
    title: data.title,
    description: null,
    source: data.source,
    url: null,
    publishedAt: data.publishedAt,
    category: data.category,
  });
  markArticleProcessed(id, "no_event", 0, null);
}

console.log("Demo data seeded successfully!");
