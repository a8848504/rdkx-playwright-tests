const { randomUUID } = require('node:crypto');
const { test, expect } = require('../../support/app-test');
const { recordRow, listAfter, openManagement, searchRecord, fillField, saveDialog, removeRecord, screenshot, cleanupRecords } = require('../../support/management');

test('职位管理：新增、修改并删除测试职位', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const name = `PWP测${suffix}`, editedName = `PWP改${suffix}`;
  const description = 'Playwright 自动化测试职位', editedDescription = 'Playwright 已修改的测试职位说明';
  let submitted = false, deleted = false;
  try {
    await test.step('组织架构 → 职位管理', async () => {
      await openManagement(page, 'position');
      for (const value of [editedName, name]) expect(await searchRecord(page, 'position', value)).not.toContain(value);
    });
    await test.step(`新增职位：${name}`, async () => {
      await page.getByText('新增职位', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '新增职位', exact: true });
      await fillField(dialog, '请输入职位名称', name);
      await fillField(dialog, '请输入职位说明', description);
      submitted = true;
      await saveDialog(page, 'position', dialog);
    });
    await test.step('刷新并搜索，确认职位与说明已保存', async () => {
      await listAfter(page, 'position', () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(await searchRecord(page, 'position', name)).toContain(name);
      await expect(recordRow(page, name)).toHaveCount(1, { timeout: 15000 });
      await expect(recordRow(page, name)).toContainText(description);
      await screenshot(page, testInfo, '01-position-created.png', '职位新增成功');
    });
    await test.step('修改职位名称和说明', async () => {
      await recordRow(page, name).getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder('请输入职位名称', { exact: true })).toHaveValue(name);
      await fillField(dialog, '请输入职位名称', editedName);
      await fillField(dialog, '请输入职位说明', editedDescription);
      await saveDialog(page, 'position', dialog);
    });
    await test.step('刷新核对修改结果和旧名称消失', async () => {
      await listAfter(page, 'position', () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(await searchRecord(page, 'position', name)).not.toContain(name);
      expect(await searchRecord(page, 'position', editedName)).toContain(editedName);
      await expect(recordRow(page, editedName)).toHaveCount(1, { timeout: 15000 });
      await expect(recordRow(page, editedName)).toContainText(editedDescription);
      await screenshot(page, testInfo, '02-position-edited.png', '职位名称和说明修改成功');
    });
    await test.step('删除并刷新搜索确认不存在', async () => {
      await removeRecord(page, 'position', editedName);
      await listAfter(page, 'position', () => page.reload({ waitUntil: 'domcontentloaded' }));
      for (const value of [name, editedName]) {
        expect(await searchRecord(page, 'position', value)).not.toContain(value);
        await expect(recordRow(page, value)).toHaveCount(0);
      }
      deleted = true;
      await screenshot(page, testInfo, '03-position-deleted.png', '职位删除成功');
    });
  } catch (error) {
    test.setTimeout(testInfo.timeout + 90000);
    await screenshot(page, testInfo, 'failure.png', '职位用例失败页面').catch(() => {});
    if (submitted && !deleted) {
      try { await test.step('清理本次测试职位', () => cleanupRecords(page, 'position', [editedName, name])); }
      catch (cleanupError) { throw new AggregateError([error, cleanupError], `职位清理失败：${name} / ${editedName}`); }
    }
    throw error;
  }
});
