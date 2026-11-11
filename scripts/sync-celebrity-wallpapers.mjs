#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { indexAllCelebrityPhotos } from './index-celebrity-photos.mjs';

export async function syncWallpapers(customOutputPath) {
  return await indexAllCelebrityPhotos();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  syncWallpapers().catch((err) => {
    console.error('[Sync Fatal Error]:', err);
    process.exit(1);
  });
}
