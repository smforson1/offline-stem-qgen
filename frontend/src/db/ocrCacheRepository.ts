// Owner: S3 | Purpose: Caches last N OCR results on-device so questions can be
// regenerated from previously scanned pages even when the server is offline.

import { getDB } from './database';

const MAX_CACHE_ENTRIES = 5;

export interface OcrCacheEntry {
  id: string;          // hash of the image URI acts as key
  uri_hint: string;    // truncated URI for display purposes
  full_text: string;
  subject: string;
  cached_at: string;
}

export const ocrCacheRepository = {
  /**
   * Saves an OCR result to the cache, evicting the oldest entry if over the limit.
   */
  save: async (entry: OcrCacheEntry): Promise<void> => {
    const db = await getDB();
    await db.executeSql(
      `CREATE TABLE IF NOT EXISTS ocr_cache (
        id TEXT PRIMARY KEY,
        uri_hint TEXT,
        full_text TEXT NOT NULL,
        subject TEXT,
        cached_at TEXT NOT NULL
      )`,
    );
    await db.executeSql(
      `INSERT OR REPLACE INTO ocr_cache (id, uri_hint, full_text, subject, cached_at)
       VALUES (?, ?, ?, ?, ?)`,
      [entry.id, entry.uri_hint, entry.full_text, entry.subject, entry.cached_at],
    );
    // Evict oldest entries beyond the limit
    await db.executeSql(
      `DELETE FROM ocr_cache WHERE id IN (
         SELECT id FROM ocr_cache ORDER BY cached_at ASC
         LIMIT MAX(0, (SELECT COUNT(*) FROM ocr_cache) - ?)
       )`,
      [MAX_CACHE_ENTRIES],
    );
  },

  /**
   * Returns all cached OCR entries, newest first.
   */
  getAll: async (): Promise<OcrCacheEntry[]> => {
    const db = await getDB();
    await db.executeSql(
      `CREATE TABLE IF NOT EXISTS ocr_cache (
        id TEXT PRIMARY KEY,
        uri_hint TEXT,
        full_text TEXT NOT NULL,
        subject TEXT,
        cached_at TEXT NOT NULL
      )`,
    );
    const [results] = await db.executeSql(
      'SELECT * FROM ocr_cache ORDER BY cached_at DESC',
    );
    const entries: OcrCacheEntry[] = [];
    for (let i = 0; i < results.rows.length; i++) {
      entries.push(results.rows.item(i) as OcrCacheEntry);
    }
    return entries;
  },
};
