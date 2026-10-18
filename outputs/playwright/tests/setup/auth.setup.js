const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { loadAppConfig, authDir, authFile, sessionFile } = require('../../support/app-config');

test('公共前置：登录一次并保存本轮会话', async ({ page }) => {
  test.setTimeout(90000);
  const app = loadAppConfig();
  if (!app.username || !app.password) {
    throw new Error('请填写 login.local.json，或设置 RDKX_USERNAME、RDKX_PASSWORD。');
  }
  await page.goto(app.loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page).toHaveTitle('关键机泵状态监测分析诊断系统');
  await page.getByPlaceholder('请输入账号', { exact: true }).fill(app.username);
  await page.getByPlaceholder('请输入密码', { exact: true }).fill(app.password);
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page).toHaveURL(app.homeUrl, { timeout: 30000 });
  await expect(page.getByText('超级管理员', { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByText('主菜单', { exact: true })).toBeVisible();

  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile, indexedDB: true });
  // storageState 不含 sessionStorage，单独保存并由公共页面 fixture 恢复。
  const session = await page.evaluate(() => ({ origin: location.origin, values: { ...sessionStorage } }));
  fs.writeFileSync(sessionFile, JSON.stringify(session), 'utf8');
  console.log('公共登录已完成：本轮登录 1 次；业务用例直接复用会话。');
});
