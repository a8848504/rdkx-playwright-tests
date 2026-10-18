const fs = require('node:fs');
const { test: base, expect } = require('@playwright/test');
const { loadAppConfig, sessionFile } = require('./app-config');

// 每个业务用例有独立的页面和上下文；认证由 rdkx 项目的公共前置负责。
const test = base.extend({
  page: async ({ page, context }, use) => {
    const app = loadAppConfig();
    if (fs.existsSync(sessionFile)) {
      const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
      await context.addInitScript(session => {
        if (location.origin === session.origin) {
          for (const [key, value] of Object.entries(session.values)) sessionStorage.setItem(key, value);
        }
      }, session);
    }
    await page.goto(app.homeUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await expect(page, '登录状态应可复用；UI 模式下状态过期时请先运行 auth.setup.js').toHaveURL(app.homeUrl, { timeout: 30000 });
    await expect(page.getByText('主菜单', { exact: true })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('超级管理员', { exact: true })).toBeVisible();
    await use(page);
  }
});

module.exports = { test, expect };
