"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface FileResult {
  id: number | null;
  name: string;
  size: number;
  mimeType: string;
  artist: string | null;
  title: string | null;
  album: string | null;
  year: string | null;
  genre: string | null;
  duration: number | null;
  bitrate: number | null;
  sampleRate: number | null;
  channels: number | null;
  lyricsFound: boolean;
  lyricsOriginal: string | null;
  lyricsGerman: string | null;
  lyricsLanguage: string | null;
  // UI state
  loadingLyrics?: boolean;
  lyricsError?: string | null;
  expanded?: boolean;
  lyricsTab?: "original" | "german";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function getFileIcon(mimeType: string, name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (mimeType.startsWith("video") || ["mp4", "mkv", "avi", "mov", "webm", "wmv"].includes(ext)) return "🎬";
  if (mimeType.startsWith("audio") || ["mp3", "flac", "ogg", "wav", "aac", "m4a", "wma", "opus"].includes(ext)) return "🎵";
  return "📄";
}

function langLabel(lang: string | null): string {
  if (!lang) return "";
  if (lang === "de") return "🇩🇪 Deutsch";
  if (lang === "en") return "🇬🇧 Englisch";
  return "🌍 Unbekannt";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === "") return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: "var(--surface2)", border: "1px solid var(--border)",
      borderRadius: 6, padding: "2px 8px", fontSize: 12, color: "var(--text)", marginRight: 4, marginBottom: 4,
    }}>
      <span style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function LyricsView({ original, german, language }: { original: string | null; german: string | null; language: string | null }) {
  const [tab, setTab] = useState<"original" | "german">("original");
  const lines = (tab === "original" ? original : german)?.split("\n") ?? [];

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button
          onClick={() => setTab("original")}
          style={{
            padding: "4px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
            background: tab === "original" ? "var(--accent)" : "var(--surface2)",
            color: tab === "original" ? "#fff" : "var(--muted)",
            transition: "all 0.15s",
          }}
        >
          {langLabel(language)} Original
        </button>
        {german && language !== "de" && (
          <button
            onClick={() => setTab("german")}
            style={{
              padding: "4px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
              background: tab === "german" ? "var(--accent)" : "var(--surface2)",
              color: tab === "german" ? "#fff" : "var(--muted)",
              transition: "all 0.15s",
            }}
          >
            🇩🇪 Deutsche Übersetzung
          </button>
        )}
      </div>
      <div style={{
        background: "var(--bg)", borderRadius: 10, padding: "14px 18px",
        maxHeight: 320, overflowY: "auto", fontSize: 13, lineHeight: 1.8,
        color: "var(--text)", border: "1px solid var(--border)",
        whiteSpace: "pre-wrap",
      }}>
        {lines.length === 0
          ? <span style={{ color: "var(--muted)" }}>Keine Texte verfügbar.</span>
          : lines.map((line, i) => (
              <div key={i} style={{ color: line.trim() === "" ? "transparent" : "var(--text)", minHeight: "1em" }}>
                {line || "​"}
              </div>
            ))}
      </div>
      {tab === "german" && (
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>
          ⚠️ Maschinelle Übersetzung via MyMemory API. Kann Fehler enthalten.
        </p>
      )}
    </div>
  );
}

function FileCard({ file, onFetchLyrics }: { file: FileResult; onFetchLyrics: (file: FileResult) => void }) {
  const [expanded, setExpanded] = useState(false);

  const hasIdentity = file.artist || file.title;
  const canFetchLyrics = hasIdentity && !file.lyricsFound && !file.loadingLyrics;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14,
      marginBottom: 12, overflow: "hidden", transition: "border-color 0.15s",
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "flex-start", gap: 14,
          padding: "14px 18px", cursor: "pointer",
          background: expanded ? "var(--surface2)" : "transparent",
          transition: "background 0.15s",
        }}
      >
        <span style={{ fontSize: 28, flexShrink: 0, marginTop: 2 }}>{getFileIcon(file.mimeType, file.name)}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", wordBreak: "break-all" }}>
              {file.title || file.name}
            </span>
            {file.lyricsFound && (
              <span style={{ fontSize: 11, background: "#16a34a22", color: "#4ade80", border: "1px solid #166534", borderRadius: 20, padding: "1px 8px" }}>
                🎤 Songtext gefunden
              </span>
            )}
            {file.lyricsError && (
              <span style={{ fontSize: 11, background: "#7f1d1d22", color: "#f87171", border: "1px solid #7f1d1d", borderRadius: 20, padding: "1px 8px" }}>
                Kein Text
              </span>
            )}
          </div>

          {/* Artist / Album */}
          {(file.artist || file.album) && (
            <div style={{ fontSize: 13, color: "var(--accent2)", marginTop: 2 }}>
              {file.artist && <span>{file.artist}</span>}
              {file.artist && file.album && <span style={{ color: "var(--muted)" }}> · </span>}
              {file.album && <span style={{ color: "var(--muted)" }}>{file.album}</span>}
              {file.year && <span style={{ color: "var(--muted)" }}> ({file.year})</span>}
            </div>
          )}

          {/* Filename (if different from title) */}
          {file.title && file.title !== file.name && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}>{file.name}</div>
          )}

          {/* Stats badges */}
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap" }}>
            <StatBadge label="Größe" value={formatSize(file.size)} />
            {file.duration && <StatBadge label="Länge" value={formatDuration(file.duration)} />}
            {file.bitrate && <StatBadge label="Bitrate" value={`${file.bitrate} kbps`} />}
            {file.sampleRate && <StatBadge label="Sample" value={`${(file.sampleRate / 1000).toFixed(1)} kHz`} />}
            {file.channels && <StatBadge label="Kanäle" value={file.channels === 1 ? "Mono" : file.channels === 2 ? "Stereo" : `${file.channels}ch`} />}
            {file.genre && <StatBadge label="Genre" value={file.genre} />}
            {file.mimeType && <StatBadge label="Format" value={file.mimeType.split("/").pop()?.toUpperCase()} />}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {canFetchLyrics && (
            <button
              onClick={e => { e.stopPropagation(); onFetchLyrics(file); }}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid var(--accent)",
                background: "transparent", color: "var(--accent)", cursor: "pointer", fontSize: 12, fontWeight: 600,
                whiteSpace: "nowrap", transition: "all 0.15s",
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "var(--accent)"; (e.target as HTMLButtonElement).style.color = "#fff"; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; (e.target as HTMLButtonElement).style.color = "var(--accent)"; }}
            >
              🔍 Songtext suchen
            </button>
          )}
          {file.loadingLyrics && (
            <span style={{ fontSize: 12, color: "var(--accent2)" }}>⏳ Suche…</span>
          )}
          <span style={{ color: "var(--muted)", fontSize: 18, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}>▾</span>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{ padding: "0 18px 18px", borderTop: "1px solid var(--border)" }}>
          {/* Full metadata table */}
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              📋 Metadaten
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <tbody>
                {[
                  ["Dateiname", file.name],
                  ["Interpret", file.artist],
                  ["Titel", file.title],
                  ["Album", file.album],
                  ["Jahr", file.year],
                  ["Genre", file.genre],
                  ["Dateigröße", formatSize(file.size)],
                  ["Dauer", file.duration ? formatDuration(file.duration) : null],
                  ["Bitrate", file.bitrate ? `${file.bitrate} kbps` : null],
                  ["Samplerate", file.sampleRate ? `${file.sampleRate} Hz` : null],
                  ["Kanäle", file.channels ? (file.channels === 1 ? "Mono (1)" : `Stereo (${file.channels})`) : null],
                  ["MIME-Type", file.mimeType],
                  ["Originalsprache", file.lyricsLanguage ? langLabel(file.lyricsLanguage) : null],
                ].filter(row => row[1] != null && row[1] !== "").map(([label, value]) => (
                  <tr key={String(label)} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "5px 10px 5px 0", color: "var(--muted)", width: 130, verticalAlign: "top" }}>{label}</td>
                    <td style={{ padding: "5px 0", color: "var(--text)", fontWeight: 500 }}>{String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lyrics */}
          {file.lyricsFound && file.lyricsOriginal && (
            <div style={{ marginTop: 16 }}>
              <p style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 0 }}>
                🎤 Songtexte
              </p>
              <LyricsView
                original={file.lyricsOriginal}
                german={file.lyricsGerman}
                language={file.lyricsLanguage}
              />
            </div>
          )}

          {/* No identity warning */}
          {!hasIdentity && (
            <div style={{ marginTop: 14, padding: "10px 14px", background: "#78350f22", border: "1px solid #92400e", borderRadius: 8, fontSize: 12, color: "#fbbf24" }}>
              ⚠️ Kein Interpret/Titel in den Metadaten gefunden. Songtext-Suche nicht möglich.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MediaScanner() {
  const [files, setFiles] = useState<FileResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [tab, setTab] = useState<"scanner" | "history">("scanner");
  const [history, setHistory] = useState<FileResult[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stats, setStats] = useState({ total: 0, withLyrics: 0, totalSize: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute stats
  useEffect(() => {
    const withLyrics = files.filter(f => f.lyricsFound).length;
    const totalSize = files.reduce((acc, f) => acc + f.size, 0);
    setStats({ total: files.length, withLyrics, totalSize });
  }, [files]);

  const handleFiles = useCallback(async (rawFiles: File[]) => {
    setScanning(true);
    setScanProgress(0);

    const CHUNK = 5;
    const allResults: FileResult[] = [];

    for (let i = 0; i < rawFiles.length; i += CHUNK) {
      const chunk = rawFiles.slice(i, i + CHUNK);
      const formData = new FormData();
      chunk.forEach(f => formData.append("files", f));

      try {
        const res = await fetch("/api/scan", { method: "POST", body: formData });
        const data = await res.json() as { results: FileResult[]; total: number };
        allResults.push(...data.results);
      } catch {
        // ignore chunk errors
      }

      setScanProgress(Math.round(((i + CHUNK) / rawFiles.length) * 100));
    }

    setFiles(prev => [...prev, ...allResults]);
    setScanning(false);
    setScanProgress(100);
  }, []);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    if (chosen.length > 0) handleFiles(chosen);
    e.target.value = "";
  }, [handleFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (dropped.length > 0) handleFiles(dropped);
  }, [handleFiles]);

  const fetchLyrics = useCallback(async (file: FileResult) => {
    if (!file.artist && !file.title) return;

    // Mark loading
    setFiles(prev => prev.map(f => f.id === file.id && f.name === file.name ? { ...f, loadingLyrics: true, lyricsError: null } : f));

    try {
      const res = await fetch("/api/lyrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: file.id, artist: file.artist, title: file.title }),
      });
      const data = await res.json() as {
        found: boolean;
        lyricsOriginal?: string;
        lyricsGerman?: string;
        lyricsLanguage?: string;
        message?: string;
      };

      setFiles(prev => prev.map(f => {
        if ((f.id !== null && f.id === file.id) || f.name === file.name) {
          return {
            ...f,
            loadingLyrics: false,
            lyricsFound: data.found,
            lyricsOriginal: data.lyricsOriginal ?? null,
            lyricsGerman: data.lyricsGerman ?? null,
            lyricsLanguage: data.lyricsLanguage ?? null,
            lyricsError: data.found ? null : (data.message ?? "Nicht gefunden"),
          };
        }
        return f;
      }));
    } catch {
      setFiles(prev => prev.map(f =>
        ((f.id !== null && f.id === file.id) || f.name === file.name)
          ? { ...f, loadingLyrics: false, lyricsError: "Netzwerkfehler" }
          : f
      ));
    }
  }, []);

  const fetchAllLyrics = useCallback(async () => {
    const candidates = files.filter(f => !f.lyricsFound && !f.loadingLyrics && (f.artist || f.title));
    for (const f of candidates) {
      await fetchLyrics(f);
    }
  }, [files, fetchLyrics]);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch("/api/history");
      const data = await res.json() as { files: FileResult[] };
      setHistory(data.files ?? []);
    } catch {
      // ignore
    }
    setLoadingHistory(false);
  }, []);

  const clearHistory = useCallback(async () => {
    if (!confirm("Verlauf wirklich löschen?")) return;
    await fetch("/api/history", { method: "DELETE" });
    setHistory([]);
  }, []);

  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  const filtered = files.filter(f =>
    !filterText ||
    f.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (f.artist ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
    (f.title ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
    (f.album ?? "").toLowerCase().includes(filterText.toLowerCase())
  );

  const historyFiltered = history.filter(f =>
    !filterText ||
    f.name.toLowerCase().includes(filterText.toLowerCase()) ||
    (f.artist ?? "").toLowerCase().includes(filterText.toLowerCase()) ||
    (f.title ?? "").toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", padding: "0 0 60px" }}>
      {/* Header */}
      <header style={{
        background: "linear-gradient(135deg, #1a1d27 0%, #0f1117 100%)",
        borderBottom: "1px solid var(--border)",
        padding: "28px 32px 20px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 42 }}>🎵</span>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.5px" }}>
                MediaScanner
              </h1>
              <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--muted)" }}>
                Mediadateien analysieren · Metadaten auslesen · Songtexte suchen
              </p>
            </div>
          </div>

          {/* Stats bar */}
          {files.length > 0 && (
            <div style={{ display: "flex", gap: 20, marginTop: 20, flexWrap: "wrap" }}>
              {[
                { icon: "📁", label: "Dateien", value: stats.total },
                { icon: "💾", label: "Gesamtgröße", value: formatSize(stats.totalSize) },
                { icon: "🎤", label: "Mit Songtext", value: stats.withLyrics },
                { icon: "🔍", label: "Ohne Songtext", value: stats.total - stats.withLyrics },
              ].map(s => (
                <div key={s.label} style={{
                  background: "var(--surface2)", borderRadius: 10, padding: "8px 16px",
                  border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", lineHeight: 1 }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
            {(["scanner", "history"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  background: tab === t ? "var(--accent)" : "var(--surface2)",
                  color: tab === t ? "#fff" : "var(--muted)",
                  transition: "all 0.15s",
                }}
              >
                {t === "scanner" ? "🔍 Scanner" : "🕐 Verlauf"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 32px 0" }}>

        {/* SCANNER TAB */}
        {tab === "scanner" && (
          <>
            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 18, padding: "48px 32px", textAlign: "center",
                cursor: "pointer", transition: "all 0.2s", marginBottom: 24,
                background: dragOver ? "rgba(108,99,255,0.07)" : "var(--surface)",
                transform: dragOver ? "scale(1.01)" : "scale(1)",
              }}
            >
              <div style={{ fontSize: 52, marginBottom: 12 }}>📂</div>
              <p style={{ fontSize: 17, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>
                Mediadateien hier ablegen
              </p>
              <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
                oder klicken zum Auswählen · Nur Dateien &gt;3 MB werden analysiert
              </p>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                Unterstützt: MP3, FLAC, OGG, WAV, AAC, M4A, WMA, MP4, MKV, AVI, MOV, OPUS …
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="audio/*,video/*,.mp3,.flac,.ogg,.wav,.aac,.m4a,.wma,.opus,.mp4,.mkv,.avi,.mov,.webm,.wmv"
                onChange={onFileChange}
                style={{ display: "none" }}
              />
            </div>

            {/* Scanning progress */}
            {scanning && (
              <div style={{ marginBottom: 20, background: "var(--surface)", borderRadius: 12, padding: 16, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>⏳ Dateien werden analysiert…</span>
                  <span style={{ fontSize: 13, color: "var(--accent)" }}>{scanProgress}%</span>
                </div>
                <div style={{ background: "var(--bg)", borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 6,
                    background: "linear-gradient(90deg, var(--accent), var(--accent2))",
                    width: `${scanProgress}%`, transition: "width 0.3s",
                  }} />
                </div>
              </div>
            )}

            {/* Toolbar */}
            {files.length > 0 && (
              <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  type="text"
                  placeholder="🔎 Filter nach Name, Interpret, Titel…"
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  style={{
                    flex: 1, minWidth: 200, padding: "8px 14px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text)", fontSize: 13, outline: "none",
                  }}
                />
                <button
                  onClick={fetchAllLyrics}
                  style={{
                    padding: "8px 18px", borderRadius: 8, border: "1px solid var(--green)",
                    background: "transparent", color: "var(--green)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  🎤 Alle Songtexte suchen
                </button>
                <button
                  onClick={() => setFiles([])}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
                    background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: 13,
                  }}
                >
                  ✕ Leeren
                </button>
              </div>
            )}

            {/* File list */}
            {filtered.length > 0 ? (
              <>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                  {filtered.length} Datei{filtered.length !== 1 ? "en" : ""} angezeigt
                </p>
                {filtered.map((f, i) => (
                  <FileCard key={`${f.id ?? i}-${f.name}`} file={f} onFetchLyrics={fetchLyrics} />
                ))}
              </>
            ) : !scanning && files.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                color: "var(--muted)", fontSize: 14,
              }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>🎶</div>
                <p style={{ fontWeight: 600, fontSize: 16, color: "var(--text)", marginBottom: 8 }}>
                  Noch keine Dateien gescannt
                </p>
                <p>Dateien oben ablegen oder auswählen, um zu beginnen.</p>
              </div>
            ) : null}
          </>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="🔎 Verlauf filtern…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                style={{
                  flex: 1, minWidth: 200, padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--surface)",
                  color: "var(--text)", fontSize: 13, outline: "none",
                }}
              />
              <button
                onClick={loadHistory}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)",
                  background: "transparent", color: "var(--text)", cursor: "pointer", fontSize: 13,
                }}
              >
                🔄 Aktualisieren
              </button>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  style={{
                    padding: "8px 14px", borderRadius: 8, border: "1px solid var(--red)",
                    background: "transparent", color: "var(--red)", cursor: "pointer", fontSize: 13,
                  }}
                >
                  🗑️ Verlauf löschen
                </button>
              )}
            </div>

            {loadingHistory ? (
              <div style={{ textAlign: "center", padding: "60px", color: "var(--muted)" }}>⏳ Lade Verlauf…</div>
            ) : historyFiltered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🕐</div>
                <p>Noch keine Dateien im Verlauf.</p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                  {historyFiltered.length} Einträge
                </p>
                {historyFiltered.map((f, i) => (
                  <FileCard
                    key={`hist-${f.id ?? i}`}
                    file={f}
                    onFetchLyrics={async () => {}}
                  />
                ))}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}
