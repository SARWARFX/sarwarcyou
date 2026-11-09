#!/usr/bin/env node
// Backward-compatible wrapper delegating to sync-celebrity-daily.mjs
import { main, fetchDailyNews, TARGET_CELEBRITIES } from './sync-celebrity-daily.mjs';

export { main, fetchDailyNews, TARGET_CELEBRITIES };

if (process.argv[1] && process.argv[1].endsWith('sync-bollywood-daily.mjs')) {
  main().catch((err) => {
    console.error('[Fatal Error]:', err);
    process.exit(1);
  });
}
