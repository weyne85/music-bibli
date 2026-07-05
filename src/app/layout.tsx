import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediaScanner – Mediadatei-Analyse & Songtexte",
  description: "Scanne Mediadateien, lies Metadaten aus und finde Songtexte auf Deutsch",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ background: "var(--bg)", color: "var(--text)", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
