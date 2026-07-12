import fs from 'node:fs';
import path from 'node:path';
import { addDays, captionFromFilename, loadConfig, naturalNumber, queuePath, shanghaiDateTime, writeJson } from './common.js';

const config = loadConfig();
const allowed = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);
const files = fs.readdirSync(config.videoDirectory, { withFileTypes: true })
  .filter((x) => x.isFile() && allowed.has(path.extname(x.name).toLowerCase()))
  .map((x) => x.name)
  .sort((a, b) => naturalNumber(a) - naturalNumber(b) || a.localeCompare(b, 'zh-CN'));

const queue = files.map((name, index) => {
  const day = Math.floor(index / config.times.length);
  const slot = index % config.times.length;
  const date = addDays(config.startDate, day);
  return {
    id: String(naturalNumber(name)),
    file: path.join(config.videoDirectory, name),
    caption: captionFromFilename(name, config.defaultTopics),
    scheduledAt: shanghaiDateTime(date, config.times[slot]),
    status: 'pending',
    attempts: 0,
    lastError: null,
    publishedAt: null
  };
});

writeJson(queuePath, queue);
console.log(`已生成 ${queue.length} 条任务：${queuePath}`);
console.log(`范围：${queue[0]?.scheduledAt ?? '-'} 至 ${queue.at(-1)?.scheduledAt ?? '-'}`);
