const { test, expect } = require('../../support/app-test');

test('会话复用：独立业务用例直接进入已登录首页', async ({ page }) => {
  await expect(page.getByText('超级管理员', { exact: true })).toBeVisible();
  await expect(page.getByText('主菜单', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('请输入密码', { exact: true })).not.toBeVisible();
});
