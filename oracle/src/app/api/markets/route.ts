import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getAllPredictions, getMatchesForPrediction, getPriceHistory } from "@/lib/db/queries";
import type { UnifiedMarket, Platform } from "@/types";

export async function GET() {
  try {
    initializeDatabase();
    const predictions = getAllPredictions();

    const markets: UnifiedMarket[] = predictions.map((pred) => {
      const matches = getMatchesForPrediction(pred.id);
      const history = getPriceHistory(pred.id);

      const platforms = matches.map((m) => ({
        platform: m.platform,
        externalId: m.externalId,
        marketPrice: m.marketPrice,
        edge: m.edge,
        signalStrength: m.signalStrength,
      }));

      const bestMatch = platforms.reduce(
        (best, p) => (Math.abs(p.edge) > Math.abs(best.edge) ? p : best),
        platforms[0] ?? { edge: 0, platform: "gemini" as Platform }
      );

      return {
        id: pred.id,
        eventTitle: pred.eventTitle,
        category: pred.category,
        aiProbability: pred.aiProbability,
        confidence: pred.confidence,
        reasoning: pred.reasoning,
        keyFactors: pred.keyFactors,
        newsSources: pred.newsSources,
        resolutionDate: pred.resolutionDate,
        createdAt: pred.createdAt,
        platforms,
        bestEdge: bestMatch?.edge ?? 0,
        bestEdgePlatform: bestMatch?.platform ?? "gemini",
        avgMarketPrice:
          platforms.length > 0
            ? platforms.reduce((sum, p) => sum + p.marketPrice, 0) / platforms.length
            : pred.aiProbability,
        priceHistory: history,
        articleUrl: (pred as any).articleUrl,
        articleTitle: (pred as any).articleTitle,
      };
    });

    return NextResponse.json({ markets });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
