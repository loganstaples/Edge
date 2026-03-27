import { ingestAllNews } from "@/lib/data/news";
import { fetchAllActiveGeminiEvents, getImpliedProbability } from "@/lib/data/gemini";
import { fetchActivePolymarkets, getPolymarketImpliedProbability } from "@/lib/data/polymarket";
import { extractEventsFromArticle } from "@/lib/ai/analyzer";
import { matchEventToMarkets } from "@/lib/ai/matcher";
import { computeEdge } from "@/lib/engine/edge";
import { initializeDatabase } from "@/lib/db/schema";
import {
  insertArticle,
  getUnprocessedArticles,
  markArticleProcessed,
  getRecentArticles,
  insertPrediction,
  insertMarketMatch,
  insertPriceHistory,
} from "@/lib/db/queries";
import type { PipelineCycleResult } from "@/types";

let initialized = false;

function ensureInit() {
  if (!initialized) {
    initializeDatabase();
    initialized = true;
  }
}

export async function runPipelineCycle(): Promise<PipelineCycleResult> {
  ensureInit();

  const result: PipelineCycleResult = {
    articlesIngested: 0,
    articlesAnalyzed: 0,
    eventsExtracted: 0,
    marketsMatched: 0,
    errors: [],
  };

  try {
    const existingTitles = getRecentArticles(200).map((a) => a.title);
    const newArticles = await ingestAllNews(existingTitles);

    for (const article of newArticles) {
      insertArticle({
        title: article.title,
        description: article.description,
        source: article.source,
        url: article.url,
        publishedAt: article.publishedAt,
        category: article.category,
      });
      result.articlesIngested++;
    }

    let geminiEvents: Awaited<ReturnType<typeof fetchAllActiveGeminiEvents>> = [];
    let polymarkets: Awaited<ReturnType<typeof fetchActivePolymarkets>> = [];

    try {
      geminiEvents = await fetchAllActiveGeminiEvents();
    } catch (err) {
      result.errors.push(`Gemini fetch failed: ${err}`);
    }

    try {
      polymarkets = await fetchActivePolymarkets(5);
    } catch (err) {
      result.errors.push(`Polymarket fetch failed: ${err}`);
    }

    const candidates = [
      ...geminiEvents.map((e, i) => ({
        index: i,
        title: e.title,
        platform: "gemini" as const,
        externalId: e.id,
        instrumentSymbol: e.contracts?.[0]?.instrumentSymbol,
        impliedProb: e.contracts?.[0] ? getImpliedProbability(e.contracts[0]) : 0.5,
      })),
      ...polymarkets.map((m, i) => ({
        index: geminiEvents.length + i,
        title: m.question,
        platform: "polymarket" as const,
        externalId: m.condition_id,
        tokenId: m.tokens?.find((t) => t.outcome === "Yes")?.token_id,
        impliedProb: getPolymarketImpliedProbability(m),
      })),
    ];

    const unprocessed = getUnprocessedArticles(2);

    for (const article of unprocessed) {
      try {
        const events = await extractEventsFromArticle(
          article.title,
          article.description,
          article.source
        );
        result.articlesAnalyzed++;

        if (events.length === 0) {
          markArticleProcessed(article.id, "no_event", 0, null);
          continue;
        }

        let matchCount = 0;
        let bestEdgeStr: string | null = null;
        let bestEdgeRaw = 0;

        for (const event of events) {
          result.eventsExtracted++;

          const predId = insertPrediction({
            articleId: article.id,
            ...event,
          });

          const matchCandidates = candidates.map((c) => ({
            index: c.index,
            title: c.title,
            platform: c.platform,
            externalId: c.externalId,
            instrumentSymbol: (c as any).instrumentSymbol,
            tokenId: (c as any).tokenId,
          }));

          const matches = await matchEventToMarkets(event.eventTitle, matchCandidates.slice(0, 50));

          for (const match of matches) {
            const cand = candidates[match.marketIndex];
            if (!cand) continue;

            const edgeResult = computeEdge(
              event.aiProbability,
              cand.impliedProb,
              event.confidence,
              cand.platform,
              {
                confidence: event.confidence,
                sourceCount: event.newsSources?.length ?? 1,
                keyFactorCount: event.keyFactors?.length ?? 2,
              },
            );

            insertMarketMatch({
              predictionId: predId,
              platform: cand.platform,
              externalId: cand.externalId,
              instrumentSymbol: (cand as any).instrumentSymbol,
              tokenId: (cand as any).tokenId,
              marketPrice: cand.impliedProb,
              edge: edgeResult.edge,
              signalStrength: edgeResult.signalStrength,
            });

            insertPriceHistory(predId, cand.platform, cand.impliedProb, event.aiProbability);

            matchCount++;
            result.marketsMatched++;

            if (Math.abs(edgeResult.edge) > Math.abs(bestEdgeRaw)) {
              bestEdgeRaw = edgeResult.edge;
              const sign = edgeResult.edge >= 0 ? "+" : "";
              bestEdgeStr = `${sign}${(edgeResult.edge * 100).toFixed(0)}%`;
            }
          }

        }

        const aiTag = events.length > 0 ? "event_detected" : "no_event";
        markArticleProcessed(article.id, aiTag, matchCount, bestEdgeStr);
      } catch (err) {
        result.errors.push(`Article analysis failed for "${article.title}": ${err}`);
        markArticleProcessed(article.id, "no_event", 0, null);
      }
    }
  } catch (err) {
    result.errors.push(`Pipeline cycle error: ${err}`);
  }

  return result;
}
