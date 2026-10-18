const { randomUUID } = require('node:crypto');
const { test, expect } = require('../../support/app-test');
const { loadAppConfig } = require('../../support/app-config');

// 业务截图保存在登录后；会话信息不写入追踪或录像。
test.use({ trace: 'off', video: 'off', screenshot: 'off', viewport: { width: 1600, height: 1000 }, actionTimeout: 15000 });
test.describe.configure({ retries: 0 });

function departmentRow(page, name) {
  return page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
}

// 等待页面自己的列表请求，避免把尚未加载误判为“记录不存在”。
async function loadDepartmentTree(page, action) {
  const [response] = await Promise.all([
    page.waitForResponse(response => response.request().method() === 'GET'
      && new URL(response.url()).pathname.endsWith('/dept/tree'), { timeout: 30000 }),
    action()
  ]);
  expect(response.ok(), '部门列表请求应成功').toBeTruthy();
  const payload = await response.json();
  await expect(page.getByRole('columnheader', { name: '部门名称', exact: true })).toBeVisible();
  return JSON.stringify(payload);
}

async function capture(page, testInfo, filename, label) {
  const screenshot = testInfo.outputPath(filename);
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach(label, { path: screenshot, contentType: 'image/png' });
}

async function deleteDepartment(page, name) {
  const row = departmentRow(page, name);
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await row.getByRole('button', { name: '删除', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '提示', exact: true });
  await expect(dialog).toContainText(name);
  const tree = await loadDepartmentTree(page, () => dialog.getByRole('button', { name: '确定', exact: true }).click());
  await expect(dialog).not.toBeVisible();
  expect(tree, '服务端列表不应再包含被删除的测试部门').not.toContain(name);
  await expect(row).toHaveCount(0, { timeout: 15000 });
}

test('部门管理：新增、编辑并删除测试部门', async ({ page }, testInfo) => {
  test.setTimeout(180000);

  // 短名称避免截断；每次运行独立，只操作本次生成的完整名称。
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const name = `PW测${suffix}`;
  const editedName = `PW改${suffix}`;
  const departmentUrl = new URL(loadAppConfig().departmentUrl);
  let creationSubmitted = false;
  let deletionVerified = false;

  try {
    await test.step('主菜单 → 组织架构 → 部门管理', async () => {
      await page.getByText('主菜单', { exact: true }).click();
      await page.getByText('组织架构', { exact: true }).click();
      const tree = await loadDepartmentTree(page, () => page.getByRole('menuitem', { name: '部门管理', exact: true }).click());
      await expect(page).toHaveURL(departmentUrl.href);
      expect(tree, '新增名称不能与现有部门重名').not.toContain(name);
      expect(tree, '编辑名称不能与现有部门重名').not.toContain(editedName);
    });

    await test.step(`新增部门：${name}`, async () => {
      await page.getByText('新增部门', { exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '新增一级部门', exact: true });
      const input = dialog.getByPlaceholder('请输入部门名称', { exact: true });
      await input.fill(name);
      await expect(input, '确认名称没有被输入框截断').toHaveValue(name);
      creationSubmitted = true;
      const tree = await loadDepartmentTree(page, () => dialog.getByRole('button', { name: '确认', exact: true }).click());
      await expect(dialog).not.toBeVisible();
      expect(tree).toContain(name);
      await expect(departmentRow(page, name)).toHaveCount(1, { timeout: 15000 });
    });

    await test.step('刷新部门管理列表，确认新增已保存', async () => {
      const tree = await loadDepartmentTree(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(tree).toContain(name);
      const row = departmentRow(page, name);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await capture(page, testInfo, '01-department-created.png', '新增成功：刷新后部门存在');
    });

    await test.step(`编辑部门：${name} → ${editedName}`, async () => {
      await departmentRow(page, name).getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `编辑【${name}】部门`, exact: true });
      const input = dialog.getByPlaceholder('请输入部门名称', { exact: true });
      await expect(input).toHaveValue(name);
      await input.fill(editedName);
      await expect(input).toHaveValue(editedName);
      const tree = await loadDepartmentTree(page, () => dialog.getByRole('button', { name: '确认', exact: true }).click());
      await expect(dialog).not.toBeVisible();
      expect(tree).toContain(editedName);
      expect(tree).not.toContain(name);
    });

    await test.step('刷新列表，确认新名称已保存且旧名称消失', async () => {
      const tree = await loadDepartmentTree(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(tree).toContain(editedName);
      expect(tree).not.toContain(name);
      await expect(departmentRow(page, name)).toHaveCount(0);
      const row = departmentRow(page, editedName);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      await row.scrollIntoViewIfNeeded();
      await expect(row).toBeVisible();
      await capture(page, testInfo, '02-department-edited.png', '编辑成功：刷新后仅保留新名称');
    });

    await test.step(`删除本次测试部门：${editedName}`, async () => {
      await deleteDepartment(page, editedName);
    });

    await test.step('刷新列表，确认本次测试部门已彻底移除', async () => {
      const tree = await loadDepartmentTree(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
      expect(tree).not.toContain(name);
      expect(tree).not.toContain(editedName);
      await expect(departmentRow(page, name)).toHaveCount(0);
      await expect(departmentRow(page, editedName)).toHaveCount(0);
      deletionVerified = true;
      await capture(page, testInfo, '03-department-deleted.png', '删除成功：刷新后两种名称均不存在');
      await testInfo.attach('测试部门生命周期', {
        body: Buffer.from(JSON.stringify({ name, editedName, status: 'deleted', verifiedAfterReload: true }, null, 2)),
        contentType: 'application/json'
      });
    });
  } catch (error) {
    test.setTimeout(testInfo.timeout + 60000);
    await capture(page, testInfo, 'failure.png', '失败时页面').catch(() => {});
    if (creationSubmitted && !deletionVerified) {
      try {
        await test.step('失败时清理本次创建的测试部门', async () => {
          // 跳转关闭残留弹窗；重新请求列表后，只查找本次生成的两个名称。
          await page.goto(departmentUrl.href, { waitUntil: 'domcontentloaded' });
          const tree = await loadDepartmentTree(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
          for (const candidate of [editedName, name]) {
            if (tree.includes(candidate)) await deleteDepartment(page, candidate);
          }
          const verifiedTree = await loadDepartmentTree(page, () => page.reload({ waitUntil: 'domcontentloaded' }));
          expect(verifiedTree).not.toContain(name);
          expect(verifiedTree).not.toContain(editedName);
        });
      } catch (cleanupError) {
        throw new AggregateError([error, cleanupError], `用例失败且清理失败：${name} / ${editedName}`);
      }
    }
    throw error;
  }
});
