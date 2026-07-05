import { NextResponse } from "next/server";
import { db } from "@/db";
import { scannedFiles } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  try {
    const files = await db
      .select()
      .from(scannedFiles)
      .orderBy(desc(scannedFiles.createdAt))
      .limit(100);
    return NextResponse.json({ files });
  } catch (err) {
    console.error("History error:", err);
    return NextResponse.json({ error: "Fehler beim Abrufen der Verlauf." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await db.delete(scannedFiles);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen." }, { status: 500 });
  }
}
