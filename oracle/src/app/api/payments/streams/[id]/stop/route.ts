import { NextResponse } from "next/server";
import { stopStream } from "@/lib/payments/streams";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  stopStream(params.id);
  return NextResponse.json({ status: "stopped" });
}
