import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadConfig, naturalNumber, root } from './common.js';

const config = loadConfig();
const ffmpeg = config.ffmpegPath;
const ffprobe = config.ffprobePath;
const outputDir = path.resolve(config.cleanedDirectory);
const reportPath = path.join(root, 'logs', 'metadata-clean-report.json');
const allowed = new Set(['.mp4', '.mov', '.mkv', '.avi', '.webm']);

fs.mkdirSync(outputDir, { recursive: true });
fs.mkdirSync(path.dirname(reportPath), { recursive: true });

const files = fs.readdirSync(config.videoDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name)
  .sort((a, b) => naturalNumber(a) - naturalNumber(b) || a.localeCompare(b, 'zh-CN'));

if (!ffmpeg || !fs.existsSync(ffmpeg)) throw new Error('Configure a valid ffmpegPath');
if (!ffprobe || !fs.existsSync(ffprobe)) throw new Error('Configure a valid ffprobePath');
if (path.resolve(config.videoDirectory) === outputDir) throw new Error('cleanedDirectory must differ from videoDirectory');

const report = [];
for (let index = 0; index < files.length; index += 1) {
  const name = files[index];
  const input = path.join(config.videoDirectory, name);
  const output = path.join(outputDir, name);
  const clean = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-map', '0', '-map_metadata', '-1', '-map_chapters', '-1',
    '-c', 'copy', '-metadata', 'comment=', '-metadata', 'AIGC=', output
  ], { encoding: 'utf8', windowsHide: true });

  if (clean.status !== 0) {
    report.push({ name, ok: false, stage: 'clean', error: clean.stderr });
    console.error(`[${index + 1}/${files.length}] 失败：${name}`);
    continue;
  }

  const probe = spawnSync(ffprobe, [
    '-v', 'error', '-show_entries', 'format_tags:stream_tags', '-of', 'json', output
  ], { encoding: 'utf8', windowsHide: true });
  const probeText = `${probe.stdout}\n${probe.stderr}`;
  const forbidden = /AIGC|ContentProducer|ProduceID|ContentPropagator|PropagateID|workflow|class_type|prompt/i;
  const ok = probe.status === 0 && !forbidden.test(probeText);
  report.push({ name, ok, stage: 'verify', bytes: fs.statSync(output).size,
    error: ok ? null : '清理后仍检测到生成元数据或 ffprobe 验证失败' });
  console.log(`[${index + 1}/${files.length}] ${ok ? '完成' : '验证失败'}：${name}`);
}

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
const passed = report.filter((item) => item.ok).length;
console.log(`清理完成：${passed}/${files.length}。输出目录：${outputDir}`);
if (passed !== files.length) process.exitCode = 1;
