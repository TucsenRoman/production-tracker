import { NextResponse } from "next/server";
import { fetchInventory } from "@/lib/clover";

export async function GET() {
  try {
    const items = await fetchInventory();
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
