import type { StageMediaItem, SortOrder } from '../types';

/**
 * Extracts a numeric timestamp from filename or path string.
 * Supports:
 * - 13-digit Unix millisecond epoch (e.g. FB_IMG_1753219228097.jpg)
 * - 10-digit Unix second epoch (e.g. 1753219228)
 * - Date-time stamps: YYYYMMDD_HHMMSS or YYYY-MM-DD-HH-MM-SS or ISO
 * - Standard date patterns: YYYYMMDD, YYYY-MM-DD, VID_YYYYMMDD_..., IMG_YYYYMMDD_...
 * - Folder/filename year patterns (H2027, H2026, H2025, 2024...)
 */
export function extractTimestampFromPath(str: string): number {
  if (!str) return 0;

  // 1. Millisecond Unix timestamp (13 digits: ~1600000000000 to ~1899999999999)
  const msMatch = str.match(/(?:^|[^0-9])(1[6-8][0-9]{11})(?:[^0-9]|$)/);
  if (msMatch) {
    const val = parseInt(msMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  // 2. Second Unix timestamp (10 digits: ~1600000000 to ~1899999999)
  const secMatch = str.match(/(?:^|[^0-9])(1[6-8][0-9]{8})(?:[^0-9]|$)/);
  if (secMatch) {
    const val = parseInt(secMatch[1], 10) * 1000;
    if (!isNaN(val) && val > 0) return val;
  }

  // 3. Date with optional time (YYYYMMDD_HHMMSS or YYYY-MM-DD-HH-MM-SS or ISO)
  const dateTimeMatch = str.match(
    /(20[1-3][0-9])[-_.]?([0-1][0-9])[-_.]?([0-3][0-9])[-_T ]?([0-2][0-9])[-_.:]?([0-5][0-9])(?:[-_.:]?([0-5][0-9]))?/
  );
  if (dateTimeMatch) {
    const y = parseInt(dateTimeMatch[1], 10);
    const m = parseInt(dateTimeMatch[2], 10) - 1;
    const d = parseInt(dateTimeMatch[3], 10);
    const hh = dateTimeMatch[4] ? parseInt(dateTimeMatch[4], 10) : 12;
    const mm = dateTimeMatch[5] ? parseInt(dateTimeMatch[5], 10) : 0;
    const ss = dateTimeMatch[6] ? parseInt(dateTimeMatch[6], 10) : 0;
    const dt = new Date(y, m, d, hh, mm, ss).getTime();
    if (!isNaN(dt) && dt > 0) return dt;
  }

  // 4. Date only (YYYYMMDD or YYYY-MM-DD or YYYY.MM.DD)
  const dateMatch = str.match(/(20[1-3][0-9])[-_.]?([0-1][0-9])[-_.]?([0-3][0-9])/);
  if (dateMatch) {
    const y = parseInt(dateMatch[1], 10);
    const m = parseInt(dateMatch[2], 10) - 1;
    const d = parseInt(dateMatch[3], 10);
    const dt = new Date(y, m, d, 12, 0, 0).getTime();
    if (!isNaN(dt) && dt > 0) return dt;
  }

  return 0;
}

/**
 * Returns the effective timestamp for any media item, prioritizing:
 * 1. dateModified / modified / uploadDate / timestamp
 * 2. High-precision filename timestamp (capture/creation date embedded in filename)
 * 3. Explicit item.date / item.lastCommit.date
 */
export function getItemTimestamp(item: {
  date?: number;
  lastCommit?: { date?: string; id?: string; title?: string };
  path?: string;
  name?: string;
  title?: string;
  url?: string;
  id?: string;
  dateModified?: string | number;
  modified?: string | number;
  uploadDate?: string | number;
  timestamp?: string | number;
}): number {
  const dm =
    (item as any).dateModified ||
    (item as any).modified ||
    (item as any).uploadDate ||
    (item as any).timestamp;
  if (dm) {
    if (typeof dm === 'number' && dm > 0) return dm;
    const parsed = new Date(dm).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  // Prioritize specific capture/creation date embedded directly in filename
  const filename = item.name || item.title || (item.path ? item.path.split('/').pop() : '') || '';
  const fnTime = extractTimestampFromPath(filename);
  if (fnTime > 0) {
    return fnTime;
  }

  if (item.date && item.date > 0) return item.date;
  if (item.lastCommit?.date) {
    const parsed = new Date(item.lastCommit.date).getTime();
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }

  return 0;
}

export interface SerialInfo {
  prefix: string;
  serial: number;
  isExplicitSerial: boolean;
}

/**
 * Extracts a numerical serial number or sequence number from a filename or title.
 * Handles patterns like:
 * - "Webmedia Serial 496" -> serial 496, isExplicitSerial: true
 * - "webmedia-serial-427-tejashwini-4k" -> serial 427, isExplicitSerial: true
 * - "webmedia-serial-45" -> serial 45, isExplicitSerial: true
 * - "Serial 1" -> serial 1, isExplicitSerial: true
 * - "Borsha (2)" -> serial 2, isExplicitSerial: false
 * - "Inna 1" -> serial 1, isExplicitSerial: false
 * - "SmartSelect Works 3" -> serial 3, isExplicitSerial: false
 */
export function extractSerialNumber(str: string): SerialInfo | null {
  if (!str) return null;
  const clean = str.replace(/\.[a-z0-9]{2,5}$/i, '').trim();

  // 1. Explicit 'serial', 'part', 'ep', 'episode', or 'no' keyword anywhere in name:
  const explicitMatch = clean.match(/(?:webmedia[-_ ]*)?(?:serial|part|episode|ep|no)[-_ #]*(\d+)/i);
  if (explicitMatch) {
    const serial = parseInt(explicitMatch[1], 10);
    if (!isNaN(serial)) {
      return { prefix: 'serial', serial, isExplicitSerial: true };
    }
  }

  // 2. Trailing number or number in parentheses: e.g. "Borsha (2)", "Classic 1", "Farida 02"
  const trailingMatch = clean.match(/^(.*?)[\s_(-]+(\d+)\)?$/i);
  if (trailingMatch) {
    const rawPrefix = trailingMatch[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    const serial = parseInt(trailingMatch[2], 10);
    if (!isNaN(serial)) {
      return { prefix: rawPrefix, serial, isExplicitSerial: false };
    }
  }

  // 3. Any number in filename
  const anyNumMatch = clean.match(/(?:^|\D)(\d+)(?:\D|$)/);
  if (anyNumMatch) {
    const serial = parseInt(anyNumMatch[1], 10);
    if (!isNaN(serial)) {
      return { prefix: '', serial, isExplicitSerial: false };
    }
  }

  return null;
}

/**
 * Global media item comparator implementing strict reverse-chronological ordering:
 * 1. Timestamp / Date modified or created (newest to oldest: b.timestamp - a.timestamp)
 * 2. Numerical serial extraction if filenames contain numbers (e.g. Webmedia Serial 496 before Webmedia Serial 495, Webmedia Serial 1)
 * 3. Natural alphanumeric sort descending as fallback (b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' }))
 */
export function compareMediaItemsDescending(
  a: {
    date?: number;
    lastCommit?: { date?: string; id?: string; title?: string };
    path?: string;
    name?: string;
    title?: string;
    url?: string;
    id?: string;
    dateModified?: string | number;
    modified?: string | number;
    uploadDate?: string | number;
    timestamp?: string | number;
  },
  b: {
    date?: number;
    lastCommit?: { date?: string; id?: string; title?: string };
    path?: string;
    name?: string;
    title?: string;
    url?: string;
    id?: string;
    dateModified?: string | number;
    modified?: string | number;
    uploadDate?: string | number;
    timestamp?: string | number;
  }
): number {
  // Priority 1: Timestamp / Date modified or created (newest to oldest)
  const timeA = getItemTimestamp(a);
  const timeB = getItemTimestamp(b);
  if (timeA > 0 && timeB > 0 && timeA !== timeB) {
    return timeB - timeA;
  }
  if (timeB > 0 && timeA <= 0) return 1;
  if (timeA > 0 && timeB <= 0) return -1;

  // Secondary timestamp check: filename timestamp tiebreaker if commit dates were identical
  const fnA = a.name || a.title || (a.path ? a.path.split('/').pop() : '') || '';
  const fnB = b.name || b.title || (b.path ? b.path.split('/').pop() : '') || '';
  const fnTimeA = extractTimestampFromPath(fnA);
  const fnTimeB = extractTimestampFromPath(fnB);
  if (fnTimeA > 0 && fnTimeB > 0 && fnTimeA !== fnTimeB) {
    return fnTimeB - fnTimeA;
  }
  if (fnTimeB > 0 && fnTimeA <= 0) return 1;
  if (fnTimeA > 0 && fnTimeB <= 0) return -1;

  // Priority 2: Numerical serial extraction if filenames contain numbers
  const strA = (a.name || a.title || a.path || a.id || '').trim();
  const strB = (b.name || b.title || b.path || b.id || '').trim();
  const sA = extractSerialNumber(strA);
  const sB = extractSerialNumber(strB);

  if (sA && sB) {
    if (sA.isExplicitSerial && sB.isExplicitSerial) {
      if (sB.serial !== sA.serial) return sB.serial - sA.serial;
    } else if (sA.prefix && sB.prefix && sA.prefix === sB.prefix) {
      if (sB.serial !== sA.serial) return sB.serial - sA.serial;
    } else if (!sA.prefix && !sB.prefix) {
      if (sB.serial !== sA.serial) return sB.serial - sA.serial;
    }
  }

  // Priority 3: Natural alphanumeric sort descending as fallback (e.g. higher numbers / letters first)
  return strB.localeCompare(strA, undefined, { numeric: true, sensitivity: 'base' });
}

/**
 * Universal sort function for StageMediaItem collections:
 * - 'newest' (Default): Global reverse-chronological ordering (latest items first)
 * - 'oldest': Oldest dateModified / commit / upload timestamp first
 * - 'name-asc': Alphabetical order by title / filename (A–Z)
 */
export function sortMediaItems(items: StageMediaItem[], order: SortOrder = 'newest'): StageMediaItem[] {
  return [...items].sort((a, b) => {
    if (order === 'name-asc') {
      const nameA = a.title || a.name || a.id || '';
      const nameB = b.title || b.name || b.id || '';
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    }
    if (order === 'oldest') {
      return compareMediaItemsDescending(b, a);
    }
    // Default: 'newest' (latest items first)
    return compareMediaItemsDescending(a, b);
  });
}

/**
 * Sorts any list of media items strictly in descending order (latest first):
 * Primary: Newest dateModified / commit / upload timestamp first
 * Secondary: Numerical serial extraction (Webmedia Serial 496 before 495)
 * Tertiary: Natural alphanumeric sort descending as fallback
 */
export function sortMediaItemsDescending<T extends {
  date?: number;
  lastCommit?: { date?: string; id?: string; title?: string };
  path?: string;
  name?: string;
  title?: string;
  url?: string;
  id?: string;
  dateModified?: string | number;
  modified?: string | number;
  uploadDate?: string | number;
  timestamp?: string | number;
}>(items: T[]): T[] {
  return [...items].sort(compareMediaItemsDescending);
}
