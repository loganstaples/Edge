import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(req: Request) {
  const { text } = await req.json();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const client = new Anthropic();
  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    system: "Analyze the sentiment of the given text. Return ONLY valid JSON: { \"sentiment_score\": <number from -1 to 1>, \"magnitude\": <number from 0 to 1> }",
    messages: [{ role: "user", content: text }],
  });

  const responseText = message.content[0].type === "text" ? message.content[0].text : "";
  const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const result = JSON.parse(cleaned);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ sentiment_score: 0, magnitude: 0 });
  }
}
