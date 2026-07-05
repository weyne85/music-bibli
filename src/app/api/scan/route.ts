import { NextRequest, NextResponse } from "next/server";
import { parseBuffer } from "music-metadata";
import { db } from "@/db";
import { scannedFiles } from "@/db/schema";

const MIN_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB

const MEDIA_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/flac",
  "audio/ogg",
  "audio/wav",
  "audio/aac",
  "audio/webm",
  "audio/x-ms-wma",
  "audio/x-aiff",
  "audio/x-flac",
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
  "video/x-matroska",
  "video/x-ms-wmv",
  "application/octet-stream",
]);

const MEDIA_EXTENSIONS = new Set([
  "mp3", "mp4", "m4a", "flac", "ogg", "wav", "aac", "wma", "aiff", "aif",
  "opus", "m4b", "m4p", "mpeg", "mpg", "mov", "avi", "mkv", "webm", "wmv",
]);

function isMediaFile(name: string, type: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES.has(type) || MEDIA_EXTENSIONS.has(ext);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Keine Dateien übermittelt." }, { status: 400 });
    }

    const results = [];

    for (const file of files) {
      const size = file.size;
      const name = file.name;
      const mimeType = file.type || "application/octet-stream";

      // Filter: only media files > 3MB
      if (size < MIN_SIZE_BYTES) continue;
      if (!isMediaFile(name, mimeType)) continue;

      let artist: string | undefined;
      let title: string | undefined;
      let album: string | undefined;
      let year: string | undefined;
      let genre: string | undefined;
      let duration: number | undefined;
      let bitrate: number | undefined;
      let sampleRate: number | undefined;
      let channels: number | undefined;

      // Parse metadata
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const metadata = await parseBuffer(buffer, { mimeType }, { duration: true, skipPostHeaders: true });

        const common = metadata.common;
        const fmt = metadata.format;

        artist = common.artist || common.albumartist || (common.artists?.[0]);
        title = common.title;
        album = common.album;
        year = common.year?.toString();
        genre = common.genre?.[0];
        duration = fmt.duration ? Math.round(fmt.duration) : undefined;
        bitrate = fmt.bitrate ? Math.round(fmt.bitrate / 1000) : undefined; // kbps
        sampleRate = fmt.sampleRate;
        channels = fmt.numberOfChannels;
      } catch {
        // Metadata parsing failed – continue with basic info
      }

      // Guess title from filename if no tag
      if (!title) {
        const base = name.replace(/\.[^/.]+$/, "");
        // common pattern: "Artist - Title"
        const match = base.match(/^(.+?)\s*[-–]\s*(.+)$/);
        if (match) {
          if (!artist) artist = match[1].trim();
          title = match[2].trim();
        } else {
          title = base;
        }
      }

      // Save to DB
      let dbRecord;
      try {
        const [record] = await db
          .insert(scannedFiles)
          .values({
            name,
            path: name,
            size,
            mimeType,
            duration,
            artist,
            title,
            album,
            year,
            genre,
            bitrate,
            sampleRate,
            channels,
            lyricsFound: false,
          })
          .returning();
        dbRecord = record;
      } catch {
        dbRecord = { id: null, name, size, mimeType, artist, title, album, year, genre, duration, bitrate, sampleRate, channels };
      }

      results.push({
        id: dbRecord.id,
        name,
        size,
        mimeType,
        artist: artist ?? null,
        title: title ?? null,
        album: album ?? null,
        year: year ?? null,
        genre: genre ?? null,
        duration: duration ?? null,
        bitrate: bitrate ?? null,
        sampleRate: sampleRate ?? null,
        channels: channels ?? null,
        lyricsFound: false,
        lyricsOriginal: null,
        lyricsGerman: null,
        lyricsLanguage: null,
      });
    }

    return NextResponse.json({ results, total: results.length });
  } catch (err) {
    console.error("Scan error:", err);
    return NextResponse.json({ error: "Fehler beim Verarbeiten der Dateien." }, { status: 500 });
  }
}
