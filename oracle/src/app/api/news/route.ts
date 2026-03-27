import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db/schema";
import { getRecentArticles } from "@/lib/db/queries";

export async function GET() {
  try {
    initializeDatabase();
    const articles = getRecentArticles(50);
    return NextResponse.json({ articles });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
