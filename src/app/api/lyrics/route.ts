import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scannedFiles } from "@/db/schema";
import { eq } from "drizzle-orm";

interface LrclibResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

async function fetchFromLrclib(artist: string, title: string): Promise<string | null> {
  const params = new URLSearchParams({
    artist_name: artist,
    track_name: title,
  });
  const url = `https://lrclib.net/api/search?${params.toString()}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "MediaScanner/1.0 (https://github.com/mediascanner)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as LrclibResult[];
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  return first.plainLyrics || null;
}

async function fetchLyricsFromGenius(artist: string, title: string): Promise<string | null> {
  const query = `${artist} ${title}`.trim();
  const url = `https://some.letras.mus.br/`; // placeholder, won't be used
  void url;
  // Try OVH lyrics API as fallback
  try {
    const encoded = encodeURIComponent(artist);
    const encodedTitle = encodeURIComponent(title);
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encoded}/${encodedTitle}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json() as { lyrics?: string };
      if (data.lyrics && data.lyrics.trim().length > 10) {
        return data.lyrics.trim();
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function translateToGerman(text: string): Promise<string | null> {
  // Use MyMemory free translation API (no key needed, 5000 chars/day per IP)
  try {
    const truncated = text.slice(0, 4000);
    const params = new URLSearchParams({
      q: truncated,
      langpair: "en|de",
    });
    const res = await fetch(`https://api.mymemory.translated.net/get?${params.toString()}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      responseStatus: number;
      responseData: { translatedText: string };
    };
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      return data.responseData.translatedText;
    }
  } catch {
    // ignore
  }
  return null;
}

function detectLanguage(lyrics: string): string {
  // Very simple heuristic – German words
  const germanWords = /\b(und|der|die|das|ist|ich|du|wir|nicht|aber|ein|eine|mit|von|sie|er|es|auf|für|im|dem|den|zu|an|bei|hat)\b/gi;
  const englishWords = /\b(the|and|is|you|are|to|of|in|that|it|this|for|was|with|he|she|they|have|be|at|but|not|on|we|do|from|by|or|an|all|can|your)\b/gi;
  const germanCount = (lyrics.match(germanWords) || []).length;
  const englishCount = (lyrics.match(englishWords) || []).length;
  if (germanCount > englishCount * 1.2) return "de";
  if (englishCount > 0) return "en";
  return "unknown";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { id?: number; artist?: string; title?: string };
    const { id, artist, title } = body;

    if (!artist || !title) {
      return NextResponse.json({ error: "Interpret und Titel sind erforderlich." }, { status: 400 });
    }

    // Fetch lyrics from lrclib first, fallback to lyrics.ovh
    let lyrics = await fetchFromLrclib(artist, title);
    if (!lyrics) {
      lyrics = await fetchLyricsFromGenius(artist, title);
    }

    if (!lyrics) {
      if (id) {
        await db.update(scannedFiles).set({ lyricsFound: false }).where(eq(scannedFiles.id, id));
      }
      return NextResponse.json({ found: false, message: "Keine Songtexte gefunden." });
    }

    const detectedLang = detectLanguage(lyrics);

    // Translate to German if not already German
    let lyricsGerman: string | null = null;
    if (detectedLang !== "de") {
      lyricsGerman = await translateToGerman(lyrics);
    } else {
      lyricsGerman = lyrics;
    }

    // Save to DB
    if (id) {
      await db
        .update(scannedFiles)
        .set({
          lyricsFound: true,
          lyricsOriginal: lyrics,
          lyricsGerman: lyricsGerman,
          lyricsLanguage: detectedLang,
        })
        .where(eq(scannedFiles.id, id));
    }

    return NextResponse.json({
      found: true,
      lyricsOriginal: lyrics,
      lyricsGerman,
      lyricsLanguage: detectedLang,
    });
  } catch (err) {
    console.error("Lyrics error:", err);
    return NextResponse.json({ error: "Fehler beim Abrufen der Songtexte." }, { status: 500 });
  }
}
