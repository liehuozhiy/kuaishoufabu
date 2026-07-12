import { openBrowser } from './browser.js';

const { context, page, config } = await openBrowser();
await page.goto(config.publishUrl, { waitUntil: 'domcontentloaded' });
console.log('请在打开的 Chrome 窗口中完成快手登录，程序会自动识别登录成功。');
const deadline = Date.now() + 10 * 60 * 1000;
while (Date.now() < deadline) {
  await page.waitForTimeout(2000);
  if (page.url().includes('/article/publish/video')) {
    const uploadButton = page.getByRole('button', { name: '上传视频', exact: true });
    if (await uploadButton.count() && await uploadButton.isVisible()) break;
  }
}
if (Date.now() >= deadline) throw new Error('等待登录超时，请重新运行 npm run login');
await context.close();
console.log('登录状态已保存。');
