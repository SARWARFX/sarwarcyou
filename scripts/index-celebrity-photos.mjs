#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT_DIR, 'src', 'data', 'actressesRegistry.json');
const GALLERY_OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityGallery.json');

// Configuration
const TARGET_PHOTOS_PER_ACTRESS = 8;
const TIMEOUT_MS = 3500;

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

function cleanTitle(rawTitle, actressName) {
  if (!rawTitle) return `${actressName} Editorial Portrait`;
  let title = rawTitle.replace(/|/g, '').trim();
  // Strip common noisy suffixes
  title = title.replace(/\s*[-–|].*$/g, '').trim();
  if (title.length < 5 || title.toLowerCase() === actressName.toLowerCase()) {
    return `${actressName} Haute Couture Photoshoot`;
  }
  return title;
}

function categorizeTitle(title) {
  const lower = title.toLowerCase();
  if (lower.match(/cannes|gala|red carpet|award|premiere|filmfare|oscar|iifa/i)) return 'Red Carpet';
  if (lower.match(/vogue|elle|gq|bazaar|femina|cosmopolitan|grazi|cover|magazine/i)) return 'Editorial';
  if (lower.match(/traditional|saree|lehenga|eid|diwali|festive|wedding/i)) return 'Traditional';
  if (lower.match(/casual|airport|spotted|street|vacation|travel/i)) return 'Street Style';
  return 'Photoshoot';
}

async function searchBingTallPhotos(actressName) {
  try {
    const query = `${actressName} photoshoot portrait`;
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&qft=+filterui:aspect-tall&form=HDRSC2&first=1`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return [];

    const html = await res.text();
    const mMatches = [...html.matchAll(/class="iusc"[^>]*m="([^"]+)"/g)];
    const items = [];

    for (const m of mMatches) {
      const rawJson = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      try {
        const parsed = JSON.parse(rawJson);
        if (parsed.murl && parsed.turl) {
          items.push({
            name: actressName,
            rawTitle: parsed.t || '',
            src: parsed.murl,
            thumb: parsed.turl,
            sourcePage: parsed.purl,
          });
        }
      } catch {}
    }
    return items;
  } catch (err) {
    console.warn(`[Search Warning] Error querying Bing for ${actressName}:`, err.message);
    return [];
  }
}

async function validateImageUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Range: 'bytes=0-1024',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.ok || res.status === 206) {
      const ctype = res.headers.get('content-type') || '';
      if (ctype.includes('image') || url.match(/\.(jpe?g|png|webp)/i)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function indexAllCelebrityPhotos() {
  console.log('===========================================================');
  console.log(' CELEBRITY PHOTOGRAPH INDEXER (GOOGLE / BING SEARCH STYLE) ');
  console.log('===========================================================');

  if (!fs.existsSync(REGISTRY_FILE)) {
    console.error('Actresses registry file not found:', REGISTRY_FILE);
    return;
  }

  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  console.log(`Loaded ${registry.length} registered South Asian actresses.`);

  // Load existing gallery to preserve verified photos
  let existingGallery = [];
  if (fs.existsSync(GALLERY_OUTPUT_FILE)) {
    try {
      existingGallery = JSON.parse(fs.readFileSync(GALLERY_OUTPUT_FILE, 'utf8'));
    } catch {}
  }

  const existingMap = new Map();
  for (const item of existingGallery) {
    const list = existingMap.get(item.name.toLowerCase()) || [];
    list.push(item);
    existingMap.set(item.name.toLowerCase(), list);
  }

  const finalGallery = [];
  const seenUrls = new Set();
  let totalIndexed = 0;

  for (let idx = 0; idx < registry.length; idx++) {
    const actress = registry[idx];
    const name = actress.name;
    const actressKey = name.toLowerCase();
    console.log(`\n[${idx + 1}/${registry.length}] Indexing HD Portraits: ${name} (${actress.region})...`);

    const actressPhotos = [];
    const existing = existingMap.get(actressKey) || [];

    // Keep up to 3 existing verified photos if they exist
    for (const ex of existing) {
      if (actressPhotos.length >= 3) break;
      if (!seenUrls.has(ex.src)) {
        seenUrls.add(ex.src);
        actressPhotos.push(ex);
      }
    }

    // Now grab fresh tall editorial photoshoot portraits from web search
    const candidates = await searchBingTallPhotos(name);
    console.log(`  Found ${candidates.length} search candidates for ${name}`);

    for (const cand of candidates) {
      if (actressPhotos.length >= TARGET_PHOTOS_PER_ACTRESS) break;
      if (seenUrls.has(cand.src)) continue;

      const isValid = await validateImageUrl(cand.src);
      if (isValid) {
        seenUrls.add(cand.src);
        const title = cleanTitle(cand.rawTitle, name);
        const category = categorizeTitle(title);
        const photoId = `${slugify(name)}-${slugify(title).slice(0, 30)}-${Math.floor(Math.random() * 10000)}`;

        actressPhotos.push({
          id: photoId,
          name: name,
          title: title,
          category: category,
          src: cand.src,
          thumb: cand.thumb,
          aspect: 'portrait',
          timestamp: Date.now(),
        });
        console.log(`    [VALID] "${title}" (${cand.src.slice(0, 50)}...)`);
      }
    }

    // If still need fallback and actress has avatar, include avatar
    if (actressPhotos.length === 0 && actress.avatar) {
      actressPhotos.push({
        id: `${slugify(name)}-official-portrait`,
        name: name,
        title: `${name} Official Portrait`,
        category: 'Photoshoot',
        src: actress.avatar,
        thumb: actress.avatar,
        aspect: 'portrait',
        timestamp: Date.now(),
      });
    }

    console.log(`  => Total indexed for ${name}: ${actressPhotos.length} photos`);
    finalGallery.push(...actressPhotos);
    totalIndexed += actressPhotos.length;

    // Small courteous pause between queries
    await new Promise((r) => setTimeout(r, 400));
  }

  // Shuffle / interleave across actresses for vibrant front-page showcase
  const shuffledCatalog = finalGallery.sort((a, b) => {
    if (a.name === b.name) return (a.id || '').localeCompare(b.id || '');
    return a.name.localeCompare(b.name);
  });

  fs.writeFileSync(GALLERY_OUTPUT_FILE, JSON.stringify(shuffledCatalog, null, 2), 'utf8');

  console.log('\n===========================================================');
  console.log(`[SUCCESS] Indexed ${totalIndexed} high-resolution photos across ${registry.length} actresses!`);
  console.log(`Updated: ${GALLERY_OUTPUT_FILE}`);
  console.log('===========================================================');
  return shuffledCatalog;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  indexAllCelebrityPhotos().catch((err) => {
    console.error('[Indexer Fatal]', err);
    process.exit(1);
  });
}
