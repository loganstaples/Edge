import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getPredictionById, getMatchesForPrediction, getPriceHistory } from "@/lib/db/queries";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const pred = getPredictionById(id);
    if (!pred) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const matches = getMatchesForPrediction(pred.id);
    const history = getPriceHistory(pred.id);

    return NextResponse.json({ prediction: pred, matches, priceHistory: history });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
