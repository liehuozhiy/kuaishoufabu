import fs from 'node:fs';
import { loadConfig, profileDir, queuePath, readJson } from './common.js';

const config = loadConfig();
const queue = fs.existsSync(queuePath) ? readJson(queuePath) : [];
console.log(JSON.stringify({
  videoDirectoryExists: fs.existsSync(config.videoDirectory),
  queueItems: queue.length,
  pending: queue.filter((x) => x.status === 'pending').length,
  scheduled: queue.filter((x) => x.status === 'scheduled').length,
  failed: queue.filter((x) => x.status === 'failed').length,
  profileCreated: fs.existsSync(profileDir),
  live: config.live,
  start: queue[0]?.scheduledAt,
  end: queue.at(-1)?.scheduledAt
}, null, 2));
