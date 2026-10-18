const { test, expect } = require('@playwright/test');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

test('本机浏览器：打开页面、输入、点击和截图', async ({ page }, testInfo) => {
  await page.goto(pathToFileURL(path.join(__dirname, '../demo.html')).href);
  await expect(page).toHaveTitle('Playwright 本机测试');
  await page.getByLabel('测试内容').fill('Playwright 已在这台电脑正常运行');
  await page.getByRole('button', { name: '添加' }).click();
  await expect(page.getByRole('listitem')).toHaveText('Playwright 已在这台电脑正常运行');
  await page.getByRole('checkbox', { name: '标记完成' }).check();
  await expect(page.getByRole('status')).toHaveText('测试成功：任务已完成');
  await page.screenshot({ path: testInfo.outputPath('success.png'), fullPage: true });
  await testInfo.attach('测试成功截图', {
    path: testInfo.outputPath('success.png'), contentType: 'image/png'
  });
});
