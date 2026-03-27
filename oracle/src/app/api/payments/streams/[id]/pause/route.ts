import { NextResponse } from "next/server";
import { pauseStream } from "@/lib/payments/streams";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  pauseStream(params.id);
  return NextResponse.json({ status: "paused" });
}
