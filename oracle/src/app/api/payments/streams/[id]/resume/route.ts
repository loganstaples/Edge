import { NextResponse } from "next/server";
import { resumeStream } from "@/lib/payments/streams";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  resumeStream(params.id);
  return NextResponse.json({ status: "active" });
}
