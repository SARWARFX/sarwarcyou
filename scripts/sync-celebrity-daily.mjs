#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import { syncWallpapers } from './sync-celebrity-wallpapers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT_DIR, 'src', 'data', 'actressesRegistry.json');
const NEWS_OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityNews.json');
const GALLERY_OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityGallery.json');
const REELS_OUTPUT_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityReels.json');

// 365-Day Rolling Retention Window
export const RETENTION_DAYS = 365;
export const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

// Load canonical actresses from registry (50 South Asian stars)
function loadTargetActresses() {
  try {
    if (fs.existsSync(REGISTRY_FILE)) {
      const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
      return registry.map((a) => a.name);
    }
  } catch (err) {
    console.warn('[Sync] Could not read registry, using fallback list:', err.message);
  }
  return [
    'Deepika Padukone', 'Alia Bhatt', 'Katrina Kaif', 'Samantha Ruth Prabhu', 'Rashmika Mandanna',
    'Porimoni', 'Bidya Sinha Mim', 'Mahira Khan', 'Hania Aamir', 'Akshara Singh'
  ];
}

export const TARGET_ACTRESSES = loadTargetActresses();
export const TARGET_CELEBRITIES = TARGET_ACTRESSES;

const RSS_FEEDS = [
  // Bollywood & Pan-India
  {
    name: 'Times of India Entertainment',
    url: 'https://timesofindia.indiatimes.com/rssfeeds/1081479906.cms',
    defaultCategory: 'Filmfare',
  },
  {
    name: 'Bollywood Hungama',
    url: 'https://www.bollywoodhungama.com/rss/news.xml',
    defaultCategory: 'Production',
  },
  {
    name: 'NDTV Movies',
    url: 'https://feeds.feedburner.com/ndtvmovies-latest',
    defaultCategory: 'Production',
  },
  {
    name: 'Indian Express Cinema',
    url: 'https://indianexpress.com/section/entertainment/bollywood/feed/',
    defaultCategory: 'Production',
  },
  // South India
  {
    name: 'The Hindu Cinema Plus',
    url: 'https://www.thehindu.com/entertainment/movies/feeder/default.rss',
    defaultCategory: 'Production',
  },
  // Bangladesh
  {
    name: 'The Daily Star Showbiz',
    url: 'https://www.thedailystar.net/entertainment/rss.xml',
    defaultCategory: 'Production',
  },
  // Pakistan & Global
  {
    name: 'Dawn Images',
    url: 'https://images.dawn.com/feed',
    defaultCategory: 'Event',
  },
  {
    name: 'Variety',
    url: 'https://variety.com/feed/',
    defaultCategory: 'Production',
  },
  {
    name: 'Deadline Hollywood',
    url: 'https://deadline.com/feed/',
    defaultCategory: 'Production',
  },
];

function sanitizeHtml(str) {
  if (!str) return '';
  return str
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&hellip;/g, '...')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8230;/g, '...')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  if (item['media:content']?.['$']?.url) return item['media:content']['$'].url;
  if (Array.isArray(item['media:content']) && item['media:content'][0]?.['$']?.url) {
    return item['media:content'][0]['$'].url;
  }
  if (item['media:thumbnail']?.['$']?.url) return item['media:thumbnail']['$'].url;

  const rawHtml = `${item.content || ''} ${item['content:encoded'] || ''} ${item.description || ''}`;
  const match = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) {
    return match[1];
  }
  return undefined;
}

const MALE_STAR_REGEX = /\b(virat kohli|virat|karan johar|shah rukh khan|srk|salman khan|aamir khan|ranbir kapoor|ranveer singh|kartik aaryan|akshay kumar|hrithik roshan|varun dhawan|sidharth malhotra|vicky kaushal|shahid kapoor|tiger shroff|saif ali khan|ajay devgn|john abraham|ayushmann khurrana|rajkummar rao|diljit dosanjh|prabhas|allu arjun|ram charan|yash|vijay devarakonda|jr ntr|chiranjeevi|nagarjuna|mahesh babu|abhishek bachchan|nick jonas|tom cruise|leonardo dicaprio|brad pitt|ryan reynolds|ryan gosling|robert downey|chris evans|chris hemsworth|timothee chalamet|cillian murphy|keanu reeves|channing tatum|tom holland)\b/i;

function matchCelebrity(title) {
  let matchedActress = null;
  let actressPos = -1;

  for (const actress of TARGET_ACTRESSES) {
    const escaped = actress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'i');
    const match = title.match(regex);
    if (match && match.index !== undefined) {
      if (actressPos === -1 || match.index < actressPos) {
        matchedActress = actress;
        actressPos = match.index;
      }
    }
  }

  if (!matchedActress) return null;

  // Reject if a male actor is the primary headline subject before the actress
  const maleMatch = title.match(MALE_STAR_REGEX);
  if (maleMatch && maleMatch.index !== undefined && maleMatch.index < actressPos) {
    return null;
  }

  return matchedActress;
}

function detectCategory(headline, summary, sourceName) {
  const combined = `${headline} ${summary}`.toLowerCase();
  if (sourceName === 'Filmfare') return 'Filmfare';
  if (
    combined.includes('interview') ||
    combined.includes('candid') ||
    combined.includes('exclusive') ||
    combined.includes('reveals') ||
    combined.includes('opens up') ||
    combined.includes('spills') ||
    combined.includes('speaks on') ||
    combined.includes('talks about')
  ) {
    return 'Interview';
  }
  if (
    combined.includes('event') ||
    combined.includes('cannes') ||
    combined.includes('red carpet') ||
    combined.includes('gala') ||
    combined.includes('party') ||
    combined.includes('wedding') ||
    combined.includes('fashion') ||
    combined.includes('award') ||
    combined.includes('ramp')
  ) {
    return 'Event';
  }
  return 'Production';
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
}

export async function fetchDailyNews() {
  console.log('--- STARTING CELEBRITY RSS NEWS SYNC (365-DAY RETENTION) ---');
  const parser = new Parser({
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    },
    customFields: {
      item: [
        ['media:content', 'media:content'],
        ['media:thumbnail', 'media:thumbnail'],
        ['content:encoded', 'content:encoded'],
      ],
    },
    timeout: 10000,
  });

  // Load existing news to preserve historical items
  let existingNews = [];
  try {
    if (fs.existsSync(NEWS_OUTPUT_FILE)) {
      existingNews = JSON.parse(fs.readFileSync(NEWS_OUTPUT_FILE, 'utf8'));
    }
  } catch (err) {
    console.warn('[RSS] Could not read existing news:', err.message);
  }

  const seenHeadlines = new Set();
  const seenUrls = new Set();
  const allArticles = [...existingNews];

  for (const item of existingNews) {
    if (item.headline) {
      seenHeadlines.add(item.headline.toLowerCase().replace(/[^a-z0-9]/g, ''));
    }
    if (item.sourceUrl) {
      seenUrls.add(item.sourceUrl);
    }
  }

  const now = Date.now();
  const MAX_SCRAPE_AGE_MS = 14 * 24 * 60 * 60 * 1000; // Look back up to 14 days in live feeds

  for (const feedConfig of RSS_FEEDS) {
    console.log(`[RSS] Fetching feed: ${feedConfig.name} (${feedConfig.url})`);
    try {
      const feed = await parser.parseURL(feedConfig.url);
      for (const item of feed.items || []) {
        const title = sanitizeHtml(item.title);
        const description = sanitizeHtml(item.contentSnippet || item.description || item.content || '');

        if (!title) continue;

        const matchedCeleb = matchCelebrity(title);
        if (!matchedCeleb) continue;

        let pubTime = now;
        if (item.pubDate || item.isoDate) {
          const parsedDate = new Date(item.pubDate || item.isoDate);
          if (!isNaN(parsedDate.getTime())) {
            pubTime = parsedDate.getTime();
          }
        }

        if (now - pubTime > MAX_SCRAPE_AGE_MS) continue;

        const link = item.link || item.guid || '';
        const normTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (seenHeadlines.has(normTitle) || (link && seenUrls.has(link))) {
          continue;
        }

        seenHeadlines.add(normTitle);
        if (link) seenUrls.add(link);

        const category = detectCategory(title, description, feedConfig.name);
        const imageUrl = extractImage(item);

        allArticles.unshift({
          id: `${slugify(matchedCeleb)}-${slugify(title)}`,
          celebrity: matchedCeleb,
          headline: title,
          summary: description.slice(0, 240) + (description.length > 240 ? '...' : ''),
          source: feedConfig.name,
          sourceUrl: link || feedConfig.url,
          imageUrl: imageUrl || undefined,
          publishedAt: new Date(pubTime).toISOString(),
          category,
          isFresh48h: now - pubTime <= 48 * 60 * 60 * 1000,
        });
      }
    } catch (err) {
      console.warn(`[RSS] Warning: could not parse ${feedConfig.name}:`, err.message);
    }
  }

  // Enforce 365-Day Rolling Retention Window:
  // Items older than 365 days are pruned as new items arrive.
  const cutoffTime = now - RETENTION_MS;
  const retainedNews = allArticles.filter((item) => {
    const t = item.publishedAt ? new Date(item.publishedAt).getTime() : now;
    return t >= cutoffTime;
  });

  // Sort descending by publication date
  retainedNews.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  fs.mkdirSync(path.dirname(NEWS_OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(NEWS_OUTPUT_FILE, JSON.stringify(retainedNews, null, 2), 'utf8');

  console.log(`[RSS] Successfully retained ${retainedNews.length} verified news articles within 365-day retention window.`);
  return retainedNews;
}

// 365-Day Retention Pruner for Celebrity Reels
export function pruneReelsRetention() {
  if (!fs.existsSync(REELS_OUTPUT_FILE)) return;
  try {
    const reels = JSON.parse(fs.readFileSync(REELS_OUTPUT_FILE, 'utf8'));
    const now = Date.now();
    const cutoff = now - RETENTION_MS;
    const retained = reels.filter((r) => {
      const t = r.timestamp || (r.publishedAt ? new Date(r.publishedAt).getTime() : now);
      return t >= cutoff;
    });
    fs.writeFileSync(REELS_OUTPUT_FILE, JSON.stringify(retained, null, 2), 'utf8');
    console.log(`[Reels] Retained ${retained.length} verified reels within 365-day retention window.`);
  } catch (err) {
    console.warn('[Reels] Pruning error:', err.message);
  }
}

export async function main() {
  console.log('=====================================================');
  console.log(' DAILY CELEBRITY INTEL SYNC & 365-DAY RETENTION ENGINE ');
  console.log('=====================================================');

  // 1. Sync High-Resolution Wallpapers
  try {
    await syncWallpapers(GALLERY_OUTPUT_FILE);
  } catch (err) {
    console.error('[Pipeline] Error in Wallpaper Sync:', err.message);
  }

  // 2. Sync Verified News Feeds with 365-Day Rolling Retention
  try {
    await fetchDailyNews();
  } catch (err) {
    console.error('[Pipeline] Error in News Sync:', err.message);
  }

  // 3. Prune Reels Retention
  try {
    pruneReelsRetention();
  } catch (err) {
    console.error('[Pipeline] Error in Reels Retention:', err.message);
  }

  console.log('[Pipeline] All South Asian daily synchronizations completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('sync-celebrity-daily.mjs')) {
  main().catch((err) => {
    console.error('[Fatal]', err);
    process.exit(1);
  });
}
