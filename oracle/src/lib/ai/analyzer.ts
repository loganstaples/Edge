import Anthropic from "@anthropic-ai/sdk";
import { EVENT_EXTRACTION_SYSTEM, eventExtractionUser } from "./prompts";
import type { AIPrediction, Category, Confidence } from "@/types";

const anthropic = new Anthropic();

interface ExtractedEvent {
  event_title: string;
  category: string;
  probability: number;
  confidence: string;
  resolution_date: string;
  reasoning: string;
  key_factors: string[];
  news_sources: string[];
}

export async function extractEventsFromArticle(
  title: string,
  description: string | null,
  source: string
): Promise<Omit<AIPrediction, "id" | "createdAt" | "articleId">[]> {
  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: EVENT_EXTRACTION_SYSTEM,
      messages: [
        { role: "user", content: eventExtractionUser(title, description, source) },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as { events: ExtractedEvent[] };

    return (parsed.events ?? []).map((e) => ({
      eventTitle: e.event_title,
      category: validateCategory(e.category),
      aiProbability: Math.max(0, Math.min(1, e.probability)),
      confidence: validateConfidence(e.confidence),
      resolutionDate: e.resolution_date,
      reasoning: e.reasoning,
      keyFactors: e.key_factors ?? [],
      newsSources: e.news_sources ?? [],
    }));
  } catch (err) {
    console.error("AI event extraction failed:", err);
    return [];
  }
}

function validateCategory(cat: string): Category {
  const valid: Category[] = ["politics", "economics", "crypto", "sports", "science", "technology", "culture"];
  return valid.includes(cat as Category) ? (cat as Category) : "politics";
}

function validateConfidence(conf: string): Confidence {
  const valid: Confidence[] = ["low", "medium", "high"];
  return valid.includes(conf as Confidence) ? (conf as Confidence) : "medium";
}
