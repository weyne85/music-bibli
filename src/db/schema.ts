import { pgTable, serial, text, integer, bigint, timestamp, boolean } from "drizzle-orm/pg-core";

export const scannedFiles = pgTable("scanned_files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  path: text("path").notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  duration: integer("duration"), // seconds
  artist: text("artist"),
  title: text("title"),
  album: text("album"),
  year: text("year"),
  genre: text("genre"),
  bitrate: integer("bitrate"),
  sampleRate: integer("sample_rate"),
  channels: integer("channels"),
  lyricsFound: boolean("lyrics_found").default(false),
  lyricsOriginal: text("lyrics_original"),
  lyricsGerman: text("lyrics_german"),
  lyricsLanguage: text("lyrics_language"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type ScannedFile = typeof scannedFiles.$inferSelect;
export type NewScannedFile = typeof scannedFiles.$inferInsert;
