const { randomUUID } = require('node:crypto');
const { test, expect } = require('../../support/app-test');
const { loadAppConfig } = require('../../support/app-config');

function roleRow(page, name) {
  return page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
}

async function loadRoleList(page, action) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'POST'
      && new URL(response.url()).pathname.endsWith('/role/list'), { timeout: 30000 }),
    action()
  ]);
  expect(response.ok(), '角色列表请求应成功').toBeTruthy();
  const payload = await response.json();
  await expect(page.getByRole('columnheader', { name: '角色名称', exact: true })).toBeVisible();
  return JSON.stringify(payload);
}

// 角色列表分页，先搜索本次完整名称，不能只在当前页判断记录是否存在。
async function searchRole(page, name) {
  const input = page.getByPlaceholder('请输入角色名称', { exact: true });
  await input.fill(name);
  await expect(input).toHaveValue(name);
  return loadRoleList(page, () => page.getByRole('button', { name: /搜索/ }).click());
}

async function capture(page, testInfo, filename, label) {
  const screenshot = testInfo.outputPath(filename);
  await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
  await testInfo.attach(label, { path: screenshot, contentType: 'image/png' });
}

async function deleteRole(page, name) {
  const row = roleRow(page, name);
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await row.getByRole('button', { name: '删除', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  await expect(dialog, '确认弹窗必须指向本次测试角色').toContainText(name);
  const data = await loadRoleList(page, () => dialog.getByRole('button', { name: /^(确定|确认)$/ }).click());
  await expect(dialog).not.toBeVisible();
  expect(data).not.toContain(name);
  await expect(row).toHaveCount(0, { timeout: 15000 });
}

test('角色管理：新增、修改并删除测试角色', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const name = `PWR测${suffix}`;
  const editedName = `PWR改${suffix}`;
  const roleUrl = loadAppConfig().roleUrl;
  let creationSubmitted = false;
  let deletionVerified = false;

  try {
    await test.step('主菜单 → 组织架构 → 角色管理', async () => {
      await page.getByText('主菜单', { exact: true }).click();
      await page.getByText('组织架构', { exact: true }).click();
      await loadRoleList(page, () => page.getByRole('menuitem', { name: '角色管理', exact: true }).click());
      await expect(page).toHaveURL(roleUrl);
      expect(await searchRole(page, editedName), '编辑名称不能与现有角色重名').not.toContain(editedName);
      expect(await searchRole(page, name), '新增名称不能与现有角色重名').not.toContain(name);
    });

    await test.step(`新增角色：${name}`, async () => {
      await page.getByText('新增角色', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '新增角色', exact: true });
      const input = dialog.getByPlaceholder('请输入角色名称', { exact: true });
      await input.fill(name);
      await expect(input, '确认角色名称没有被截断').toHaveValue(name);
      await dialog.getByRole('radio', { name: '使用', exact: true }).check();
      creationSubmitted = true;
      await loadRoleList(page, () => dialog.getByRole('button', { name: '确认', exact: true }).click());
      await expect(dialog).not.toBeVisible();
    });

    await test.step('刷新并搜索，确认新增角色和启用状态已保存', async () => {
      await loadRoleList(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(await searchRole(page, name)).toContain(name);
      const row = roleRow(page, name);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      await expect(row.getByRole('cell', { name: '启用', exact: true })).toBeVisible();
      await capture(page, testInfo, '01-role-created.png', '新增成功：刷新后角色存在');
    });

    await test.step(`修改角色：${name} → ${editedName}，状态改为停用`, async () => {
      await roleRow(page, name).getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toHaveCount(1);
      const input = dialog.getByPlaceholder('请输入角色名称', { exact: true });
      await expect(input).toHaveValue(name);
      await input.fill(editedName);
      await expect(input).toHaveValue(editedName);
      await dialog.getByRole('radio', { name: '停用', exact: true }).check();
      await loadRoleList(page, () => dialog.getByRole('button', { name: '确认', exact: true }).click());
      await expect(dialog).not.toBeVisible();
    });

    await test.step('刷新并搜索，确认改名与停用已保存，旧名称消失', async () => {
      await loadRoleList(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(await searchRole(page, name)).not.toContain(name);
      await expect(roleRow(page, name)).toHaveCount(0);
      expect(await searchRole(page, editedName)).toContain(editedName);
      const row = roleRow(page, editedName);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      // 重新打开编辑弹窗读取保存的状态，避免列表与表单文案差异造成误判。
      await row.getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder('请输入角色名称', { exact: true })).toHaveValue(editedName);
      await expect(dialog.getByRole('radio', { name: '停用', exact: true })).toBeChecked();
      await dialog.getByRole('button', { name: '取消', exact: true }).click();
      await expect(dialog).not.toBeVisible();
      await expect(page.locator('.v-modal:visible'), '等待编辑弹窗遮罩关闭后再截图').toHaveCount(0);
      await capture(page, testInfo, '02-role-edited.png', '修改成功：新名称与停用状态均已保存');
    });

    await test.step(`删除本次测试角色：${editedName}`, async () => {
      await deleteRole(page, editedName);
    });

    await test.step('刷新并搜索两种名称，确认测试角色已删除', async () => {
      await loadRoleList(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      for (const candidate of [name, editedName]) {
        expect(await searchRole(page, candidate)).not.toContain(candidate);
        await expect(roleRow(page, candidate)).toHaveCount(0);
      }
      deletionVerified = true;
      await capture(page, testInfo, '03-role-deleted.png', '删除成功：刷新搜索后无测试角色');
      await testInfo.attach('测试角色生命周期', {
        body: Buffer.from(JSON.stringify({ name, editedName, editedStatus: '停用', status: 'deleted', verifiedAfterReload: true }, null, 2)),
        contentType: 'application/json'
      });
    });
  } catch (error) {
    test.setTimeout(testInfo.timeout + 90000);
    await capture(page, testInfo, 'failure.png', '角色用例失败时页面').catch(() => {});
    if (creationSubmitted && !deletionVerified) {
      try {
        await test.step('失败时只清理本次创建的测试角色', async () => {
          await page.goto(roleUrl, { waitUntil: 'domcontentloaded' });
          await loadRoleList(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
          for (const candidate of [editedName, name]) {
            const data = await searchRole(page, candidate);
            if (data.includes(candidate)) await deleteRole(page, candidate);
          }
          for (const candidate of [name, editedName]) {
            expect(await searchRole(page, candidate)).not.toContain(candidate);
            await expect(roleRow(page, candidate)).toHaveCount(0);
          }
        });
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], `角色用例失败且清理失败：${name} / ${editedName}`);
      }
    }
    throw error;
  }
});
