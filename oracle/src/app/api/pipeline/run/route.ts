import { NextResponse } from "next/server";
import { runPipelineCycle } from "@/lib/engine/pipeline";

export async function POST() {
  try {
    const result = await runPipelineCycle();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
