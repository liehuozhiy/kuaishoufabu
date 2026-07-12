import { chromium } from 'playwright';
import { loadConfig, profileDir } from './common.js';

export async function openBrowser() {
  const config = loadConfig();
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: config.browserExecutable,
    headless: config.headless,
    viewport: { width: 1440, height: 1000 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = context.pages()[0] ?? await context.newPage();
  return { context, page, config };
}

export async function assertLoggedIn(page) {
  const login = page.getByText('立即登录', { exact: true });
  if (await login.count() && await login.isVisible()) {
    throw new Error('独立自动化浏览器尚未登录快手，请先运行 npm run login');
  }
}
