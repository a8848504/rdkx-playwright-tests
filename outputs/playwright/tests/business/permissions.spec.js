const { randomUUID } = require('node:crypto');
const { test, expect } = require('../../support/app-test');
const { recordRow, listAfter, openManagement, fillField, saveDialog, cancelDialog, removeRecord, screenshot, cleanupRecords } = require('../../support/management');

test('权限管理：新增、修改并删除测试菜单权限', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const name = `PWM测${suffix}`, editedName = `PWM改${suffix}`;
  let submitted = false, deleted = false;
  try {
    await test.step('组织架构 → 权限管理', async () => {
      const data = await openManagement(page, 'permission');
      for (const value of [name, editedName]) expect(data).not.toContain(value);
    });
    await test.step('新增专用的一级测试菜单', async () => {
      await page.getByText('新增一级菜单', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '新增一级菜单', exact: true });
      await fillField(dialog, '请输入权限名称', name);
      await fillField(dialog, '请输入排序', '999999');
      // 空菜单不绑定业务 URL、权限 key 或文件，只允许 root 看见。
      await dialog.getByRole('radio', { name: '超级管理员（只有root才有此功能）', exact: true }).check();
      submitted = true;
      await saveDialog(page, 'permission', dialog);
    });
    await test.step('刷新确认新增菜单权限存在', async () => {
      const data = await listAfter(page, 'permission', () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(data).toContain(name);
      await expect(recordRow(page, name)).toHaveCount(1, { timeout: 15000 });
      await recordRow(page, name).scrollIntoViewIfNeeded();
      await screenshot(page, testInfo, '01-permission-created.png', '测试菜单权限新增成功');
    });
    await test.step('修改测试菜单权限名称', async () => {
      await recordRow(page, name).getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder('请输入权限名称', { exact: true })).toHaveValue(name);
      await fillField(dialog, '请输入权限名称', editedName);
      await saveDialog(page, 'permission', dialog);
    });
    await test.step('刷新并重新打开表单，确认新名称和开放类型已保存', async () => {
      const data = await listAfter(page, 'permission', () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(data).not.toContain(name);
      expect(data).toContain(editedName);
      await expect(recordRow(page, name)).toHaveCount(0);
      const row = recordRow(page, editedName);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      await row.getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder('请输入权限名称', { exact: true })).toHaveValue(editedName);
      await expect(dialog.getByRole('radio', { name: '超级管理员（只有root才有此功能）', exact: true })).toBeChecked();
      await cancelDialog(page, dialog);
      await row.scrollIntoViewIfNeeded();
      await screenshot(page, testInfo, '02-permission-edited.png', '测试菜单权限修改成功');
    });
    await test.step('删除测试菜单，刷新确认不存在', async () => {
      await removeRecord(page, 'permission', editedName);
      const data = await listAfter(page, 'permission', () => page.reload({ waitUntil: 'domcontentloaded' }));
      for (const value of [name, editedName]) {
        expect(data).not.toContain(value);
        await expect(recordRow(page, value)).toHaveCount(0);
      }
      deleted = true;
      await screenshot(page, testInfo, '03-permission-deleted.png', '测试菜单权限删除成功');
    });
  } catch (error) {
    test.setTimeout(testInfo.timeout + 90000);
    await screenshot(page, testInfo, 'failure.png', '权限用例失败页面').catch(() => {});
    if (submitted && !deleted) {
      try { await test.step('清理本次测试菜单权限', () => cleanupRecords(page, 'permission', [editedName, name])); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], `权限清理失败：${name} / ${editedName}`); }
    }
    throw error;
  }
});
