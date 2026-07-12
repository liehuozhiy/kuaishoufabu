import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const configPath = process.env.KUAISHOU_CONFIG
  ? path.resolve(process.env.KUAISHOU_CONFIG)
  : path.resolve(process.cwd(), 'kuaishou.config.json');

export function loadConfig() {
  const config = readJson(configPath);
  config.workDirectory = path.resolve(config.workDirectory || path.join(process.cwd(), '.kuaishou-publisher'));
  return config;
}

const runtimeConfig = loadConfig();
export const root = runtimeConfig.workDirectory;
export const queuePath = path.join(root, 'data', 'queue.json');
export const profileDir = path.join(root, 'data', 'browser-profile');
export const logDir = path.join(root, 'logs');

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function log(event, details = {}) {
  fs.mkdirSync(logDir, { recursive: true });
  const row = JSON.stringify({ time: new Date().toISOString(), event, ...details });
  fs.appendFileSync(path.join(logDir, 'publisher.jsonl'), `${row}\n`, 'utf8');
  console.log(row);
}

export function naturalNumber(name) {
  const match = name.match(/^(\d+)_/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function captionFromFilename(name, topics) {
  const base = path.basename(name, path.extname(name));
  const beforeTask = base.split('__task_')[0];
  const withoutIndex = beforeTask.replace(/^\d+_/, '');
  const title = withoutIndex.split('@')[0].trim() || '分享今日快乐';
  const found = [...withoutIndex.matchAll(/@([^(@]+)(?:\([^)]*\))?/g)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  const tags = [...new Set([...found, ...topics])].slice(0, 5).map((x) => `#${x}`);
  return `${title} ${tags.join(' ')}`.trim().slice(0, 220);
}

export function shanghaiDateTime(date, time) {
  return `${date}T${time}:00+08:00`;
}

export function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}
