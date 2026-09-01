import { NextResponse } from "next/server";
import { fetchVelocity } from "@/lib/clover";

export async function GET(request: Request) {
  const days = Number(new URL(request.url).searchParams.get("days")) || 28;

  try {
    return NextResponse.json(await fetchVelocity(days));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // Cover is a bonus signal, not load-bearing: answer 200 with an empty map so
    // the inventory screen renders without it rather than showing an error.
    return NextResponse.json({ perDay: {}, days, from: null, error: message });
  }
}
