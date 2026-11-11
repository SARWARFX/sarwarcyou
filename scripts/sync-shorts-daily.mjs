#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT_DIR, 'src', 'data', 'actressesRegistry.json');
const REELS_FILE = path.join(ROOT_DIR, 'src', 'data', 'celebrityReels.json');

const parser = new Parser();

export const CHANNELS = [
  {
    name: 'Zee Music Company',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCFFbwnve3yF62-tVXkTyHqg',
  },
  {
    name: 'YRF',
    feedUrl: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbTLwN10NoCU4WDzLf1JMOA',
  },
];

export async function syncShortsDaily() {
  console.log('[sync-shorts-daily] Initiating actress YouTube Shorts ingestion...');

  if (!fs.existsSync(REGISTRY_FILE) || !fs.existsSync(REELS_FILE)) {
    console.warn('[sync-shorts-daily] Missing registry or reels file.');
    return;
  }

  const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
  const currentReels = JSON.parse(fs.readFileSync(REELS_FILE, 'utf8'));

  const discoveredShorts = [];

  for (const channel of CHANNELS) {
    try {
      console.log(`[sync-shorts-daily] Ingesting channel feed for "${channel.name}"...`);
      const feed = await parser.parseURL(channel.feedUrl);
      console.log(`[sync-shorts-daily] Retrieved ${feed.items?.length || 0} raw items from ${channel.name}`);

      for (const item of feed.items || []) {
        const title = item.title || '';
        const isShort = /#shorts|\bshorts\b|\bshort\b/i.test(title);
        if (!isShort) continue;

        let vidId = '';
        if (item.id && item.id.includes('video:')) {
          vidId = item.id.split('video:')[1];
        } else if (item.link) {
          const m = item.link.match(/[?&]v=([^&]+)/);
          if (m) vidId = m[1];
        }
        if (!vidId) continue;

        // Match against 50 canonical actresses
        for (const actress of registry) {
          const actName = actress.name.toLowerCase();
          const actCompact = actName.replace(/\s+/g, '');
          const lowerTitle = title.toLowerCase();

          if (lowerTitle.includes(actName) || lowerTitle.includes(actCompact)) {
            discoveredShorts.push({
              actress,
              vidId,
              title: title.replace(/#shorts/gi, '').trim(),
              channel: channel.name,
              publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
            });
            console.log(`[sync-shorts-daily] MATCH [${channel.name}] -> "${title}" (${actress.name})`);
            break;
          }
        }
      }
    } catch (err) {
      console.warn(`[sync-shorts-daily] Feed error for ${channel.name}:`, err.message);
    }
  }

  // Update matching actress reels in currentReels
  let updatedCount = 0;
  discoveredShorts.forEach((ds) => {
    const existing = currentReels.find((r) => r.actressName.toLowerCase() === ds.actress.name.toLowerCase());
    if (existing) {
      existing.youtubeId = ds.vidId;
      existing.videoUrl = `https://www.youtube.com/shorts/${ds.vidId}`;
      existing.thumbnail = `https://img.youtube.com/vi/${ds.vidId}/hqdefault.jpg`;
      existing.channel = ds.channel;
      existing.title = `${ds.actress.name} • ${ds.title}`;
      updatedCount++;
    }
  });

  fs.writeFileSync(REELS_FILE, JSON.stringify(currentReels, null, 2), 'utf8');
  console.log(`[sync-shorts-daily] Ingestion complete. Updated ${updatedCount} live actress Shorts.`);
}

syncShortsDaily().catch(console.error);
