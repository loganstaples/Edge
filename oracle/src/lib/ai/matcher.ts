import Anthropic from "@anthropic-ai/sdk";
import { EVENT_MATCHING_SYSTEM, eventMatchingUser } from "./prompts";

const anthropic = new Anthropic();

interface MatchCandidate {
  index: number;
  title: string;
  platform: string;
  externalId: string;
  instrumentSymbol?: string;
  tokenId?: string;
}

interface MatchResult {
  marketIndex: number;
  confidence: string;
  candidate: MatchCandidate;
}

export async function matchEventToMarkets(
  eventTitle: string,
  candidates: MatchCandidate[]
): Promise<MatchResult[]> {
  if (candidates.length === 0) return [];

  try {
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      system: EVENT_MATCHING_SYSTEM,
      messages: [
        {
          role: "user",
          content: eventMatchingUser(
            eventTitle,
            candidates.map((c, i) => ({ index: i, title: c.title, platform: c.platform }))
          ),
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      matches: { market_index: number; confidence: string; reasoning: string }[];
    };

    return (parsed.matches ?? [])
      .filter((m) => m.market_index >= 0 && m.market_index < candidates.length)
      .map((m) => ({
        marketIndex: m.market_index,
        confidence: m.confidence,
        candidate: candidates[m.market_index],
      }));
  } catch (err) {
    console.error("AI market matching failed:", err);
    return [];
  }
}
