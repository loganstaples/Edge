import { NextRequest, NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getPriceHistory } from "@/lib/db/queries";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    initializeDatabase();
    const { id } = await params;
    const history = getPriceHistory(id);
    return NextResponse.json({ history });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
