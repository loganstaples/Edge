import { NextResponse } from "next/server";
import { recordTickPayment } from "@/lib/payments/streams";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { amount } = await req.json();
  recordTickPayment(params.id, amount);
  return NextResponse.json({ status: "ok" });
}
