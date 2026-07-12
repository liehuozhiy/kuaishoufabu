import fs from 'node:fs';
import path from 'node:path';
import { assertLoggedIn, openBrowser } from './browser.js';
import { addDays, loadConfig, log, logDir, queuePath, readJson, writeJson } from './common.js';

const dryRun = process.argv.includes('--dry-run');
const limitArg = process.argv.find((x) => x.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
const idArg = process.argv.find((x) => x.startsWith('--id='));
const targetId = idArg ? idArg.split('=')[1] : null;
const rolling = process.argv.includes('--rolling');
const todayShanghai = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());
const rollingThrough = rolling ? addDays(todayShanghai, Number(config.rollingDays ?? 12)) : null;
const config = loadConfig();
if (!dryRun && !config.live) throw new Error('config.json 中 live=false；正式批量提交前必须显式启用');

function scheduleParts(value) {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) throw new Error(`无法解析定时时间：${value}`);
  return { date: match[1], hour: match[2], minute: match[3], second: match[4] };
}

async function waitForUploadComplete(page) {
  const deadline = Date.now() + 5 * 60 * 1000;
  let stableSeconds = 0;
  while (Date.now() < deadline) {
    const state = await page.locator('body').evaluate((body) => {
      const visible = (el) => Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const texts = [...body.querySelectorAll('div,span,p')]
        .filter(visible)
        .map((el) => (el.innerText || '').trim());
      return {
        uploading: texts.some((text) => text === '上传中' || /上传中\s*\d*%/.test(text)),
        progress: texts.some((text) => /^\d{1,3}%$/.test(text)),
        failed: texts.some((text) => /上传失败|重新上传失败/.test(text))
      };
    });
    if (state.failed) throw new Error('快手页面显示上传失败');
    stableSeconds = (!state.uploading && !state.progress) ? stableSeconds + 1 : 0;
    if (stableSeconds >= 5) return;
    await page.waitForTimeout(1000);
  }
  throw new Error('等待视频完全上传超时');
}

async function chooseSchedule(page, scheduledAt) {
  const { date, hour, minute, second } = scheduleParts(scheduledAt);
  const schedule = page.getByText('定时发布', { exact: true });
  if (await schedule.count() !== 1) throw new Error('无法唯一定位“定时发布”');
  await schedule.click();

  const picker = page.locator('input[placeholder="选择日期时间"]');
  await picker.waitFor({ state: 'visible', timeout: 10000 });
  const dropdown = page.locator('.ant-picker-dropdown:visible');
  await dropdown.waitFor({ state: 'visible', timeout: 10000 });
  const dateCell = dropdown.locator(`td[title="${date}"]`);
  for (let monthStep = 0; monthStep < 12 && await dateCell.count() !== 1; monthStep += 1) {
    const nextMonth = dropdown.locator('button.ant-picker-header-next-btn');
    if (await nextMonth.count() !== 1) break;
    await nextMonth.click();
  }
  if (await dateCell.count() !== 1) throw new Error(`日期 ${date} 不在可选择范围内`);
  await dateCell.click();

  const columns = dropdown.locator('.ant-picker-time-panel-column');
  if (await columns.count() !== 3) throw new Error('定时发布的时间选择器不是预期的三列结构');
  for (const [index, value] of [[0, hour], [1, minute], [2, second]]) {
    const option = columns.nth(index).getByText(value, { exact: true });
    if (await option.count() !== 1) throw new Error(`无法选择时间值 ${value}`);
    await option.click();
  }
  const confirm = dropdown.getByText('确定', { exact: true });
  if (await confirm.count() !== 1) throw new Error('无法唯一定位日期时间“确定”按钮');
  await confirm.click();
  const expected = `${date} ${hour}:${minute}:${second}`;
  if (await picker.inputValue() !== expected) throw new Error(`定时值校验失败，期望 ${expected}，实际 ${await picker.inputValue()}`);
}

const queue = readJson(queuePath);
let completedThisRun = 0;
for (const item of queue) {
  if (item.status !== 'pending' || completedThisRun >= limit || (targetId && item.id !== targetId)) continue;
  if (rollingThrough && item.scheduledAt.slice(0, 10) > rollingThrough) continue;
  const { context, page } = await openBrowser();
  try {
    await page.goto(config.publishUrl, { waitUntil: 'domcontentloaded' });
    await assertLoggedIn(page);
    await page.locator('input[type="file"]').first().setInputFiles(item.file);
    log('schedule_upload_started', { id: item.id, scheduledAt: item.scheduledAt });
    await page.getByText('重新上传', { exact: true }).waitFor({ state: 'visible', timeout: 120000 });
    await waitForUploadComplete(page);
    log('upload_fully_complete', { id: item.id });

    const caption = page.locator('[contenteditable="true"][placeholder="作品描述不会写？试试智能文案"]');
    await caption.fill(item.caption);
    await chooseSchedule(page, item.scheduledAt);
    fs.mkdirSync(logDir, { recursive: true });

    if (dryRun) {
      await page.screenshot({ path: path.join(logDir, `schedule-dry-${item.id}.png`), fullPage: true });
      log('schedule_dry_ready', { id: item.id, caption: item.caption, scheduledAt: item.scheduledAt });
      break;
    }

    const publish = page.getByText('发布', { exact: true });
    if (await publish.count() !== 1) throw new Error('无法唯一定位“发布”控件');
    await publish.click();
    await page.waitForTimeout(3000);
    const body = await page.locator('body').innerText();
    const url = page.url();
    if (!/发布成功|审核中|内容管理/.test(body) && /article\/publish\/video/.test(url)) {
      throw new Error(`提交后未检测到成功状态，当前页面：${url}`);
    }
    item.status = 'scheduled';
    item.publishedAt = new Date().toISOString();
    item.lastError = null;
    completedThisRun += 1;
    writeJson(queuePath, queue);
    log('scheduled', { id: item.id, scheduledAt: item.scheduledAt, completedThisRun });
  } catch (error) {
    item.attempts += 1;
    item.lastError = String(error?.stack ?? error);
    if (item.attempts >= config.maxRetries) item.status = 'failed';
    writeJson(queuePath, queue);
    log('schedule_failed', { id: item.id, attempts: item.attempts, error: item.lastError });
    break;
  } finally {
    await context.close();
  }
}

console.log(`本次成功提交 ${completedThisRun} 条。${rollingThrough ? ` 滚动范围截至 ${rollingThrough}。` : ''}`);
