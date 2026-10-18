const { randomUUID } = require('node:crypto');
const { test, expect } = require('../../support/app-test');
const { recordRow, listAfter, openManagement, reopenManagement, searchRecord, fillField,
  saveDialog, removeRecord, screenshot, cleanupRecords } = require('../../support/management');

async function prepareDependencies(page, state) {
  const data = await openManagement(page, 'department');
  expect(data).not.toContain(state.department);
  await page.getByText('新增部门', { exact: true }).click();
  let dialog = page.getByRole('dialog', { name: '新增一级部门', exact: true });
  await fillField(dialog, '请输入部门名称', state.department);
  state.departmentAttempted = true;
  await saveDialog(page, 'department', dialog);
  await expect(recordRow(page, state.department)).toHaveCount(1, { timeout: 15000 });

  await openManagement(page, 'position');
  expect(await searchRecord(page, 'position', state.position)).not.toContain(state.position);
  await page.getByText('新增职位', { exact: true }).click();
  dialog = page.getByRole('dialog', { name: '新增职位', exact: true });
  await fillField(dialog, '请输入职位名称', state.position);
  await fillField(dialog, '请输入职位说明', '仅用于本轮用户自动化测试');
  state.positionAttempted = true;
  await saveDialog(page, 'position', dialog);
  expect(await searchRecord(page, 'position', state.position)).toContain(state.position);

  await openManagement(page, 'role');
  expect(await searchRecord(page, 'role', state.role)).not.toContain(state.role);
  await page.getByText('新增角色', { exact: true }).click();
  dialog = page.getByRole('dialog', { name: '新增角色', exact: true });
  await fillField(dialog, '请输入角色名称', state.role);
  await dialog.getByRole('radio', { name: '使用', exact: true }).check();
  // 不分配任何权限；只把本轮临时空角色关联给本轮临时用户。
  state.roleAttempted = true;
  await saveDialog(page, 'role', dialog);
  expect(await searchRecord(page, 'role', state.role)).toContain(state.role);
}

async function selectDepartment(page, name) {
  return listAfter(page, 'user', () => page.getByRole('tree').getByText(name, { exact: true }).click());
}

async function reloadUsers(page, state) {
  await listAfter(page, 'user', () => page.reload({ waitUntil: 'domcontentloaded' }));
  await selectDepartment(page, state.department);
}

async function cleanupUser(page, state) {
  await reopenManagement(page, 'user');
  await selectDepartment(page, state.department);
  for (const name of [state.editedName, state.name]) {
    const data = await searchRecord(page, 'user', name);
    if (data.includes(state.account)) await removeRecord(page, 'user', state.account, [state.account, name]);
  }
  await reloadUsers(page, state);
  for (const name of [state.name, state.editedName]) {
    expect(await searchRecord(page, 'user', name)).not.toContain(state.account);
    await expect(recordRow(page, state.account)).toHaveCount(0);
  }
  state.userAttempted = false;
}

async function cleanupDependencies(page, state) {
  for (const [kind, field] of [['role', 'role'], ['position', 'position'], ['department', 'department']]) {
    if (state[`${field}Attempted`]) {
      await cleanupRecords(page, kind, [state[field]]);
      state[`${field}Attempted`] = false;
    }
  }
}

test('用户管理：新增、修改并删除临时用户及关联测试记录', async ({ page }, testInfo) => {
  test.setTimeout(300000);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  const state = {
    name: `PWU测${suffix}`, editedName: `PWU改${suffix}`, account: `pwu${suffix}`,
    department: `PWUD${suffix}`, position: `PWUP${suffix}`, role: `PWUR${suffix}`,
    departmentAttempted: false, positionAttempted: false, roleAttempted: false, userAttempted: false
  };
  // 只用于本轮临时账号，不写入截图、报告、配置文件或日志。
  const password = 'Aa9@' + randomUUID().replaceAll('-', '').slice(0, 8);

  try {
    await test.step('准备专用部门、职位和空权限角色', () => prepareDependencies(page, state));
    await test.step('组织架构 → 用户管理，选择本轮专用部门', async () => {
      await openManagement(page, 'user');
      await selectDepartment(page, state.department);
      for (const name of [state.editedName, state.name]) {
        expect(await searchRecord(page, 'user', name)).not.toContain(state.account);
      }
    });
    await test.step('新增临时用户并关联本轮部门、职位与角色', async () => {
      await page.getByRole('button', { name: /新增用户/ }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toHaveCount(1);
      await fillField(dialog, '请输入姓名', state.name);
      await fillField(dialog, '请输入账号', state.account);
      await dialog.getByPlaceholder('请输入包含大、小写字母、数字,长度8-12位的密码', { exact: true }).fill(password);
      await dialog.getByPlaceholder('请选择角色', { exact: true }).click();
      await page.getByText(state.role, { exact: true }).click();
      await dialog.getByPlaceholder('请选择职位', { exact: true }).click();
      await page.getByText(state.position, { exact: true }).click();
      await dialog.getByRole('radio', { name: '在职', exact: true }).check();
      await dialog.getByRole('radio', { name: '男', exact: true }).check();
      state.userAttempted = true;
      await saveDialog(page, 'user', dialog);
    });
    await test.step('刷新搜索，确认用户资料及关联记录已保存', async () => {
      await reloadUsers(page, state);
      expect(await searchRecord(page, 'user', state.name)).toContain(state.account);
      const row = recordRow(page, state.account);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      for (const text of [state.name, state.role, state.position, state.department, '在职']) await expect(row).toContainText(text);
      await screenshot(page, testInfo, '01-user-created.png', '用户新增成功：专用部门和空角色');
    });
    await test.step('修改本轮用户姓名、性别和在职状态', async () => {
      await recordRow(page, state.account).getByRole('button', { name: '编辑', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByPlaceholder('请输入账号', { exact: true })).toHaveValue(state.account);
      await fillField(dialog, '请输入姓名', state.editedName);
      await dialog.getByRole('radio', { name: '女', exact: true }).check();
      await dialog.getByRole('radio', { name: '离职', exact: true }).check();
      await saveDialog(page, 'user', dialog);
    });
    await test.step('刷新核对姓名、性别、离职状态，确认账号未变', async () => {
      await reloadUsers(page, state);
      expect(await searchRecord(page, 'user', state.name)).not.toContain(state.account);
      expect(await searchRecord(page, 'user', state.editedName)).toContain(state.account);
      const row = recordRow(page, state.account);
      await expect(row).toHaveCount(1, { timeout: 15000 });
      for (const text of [state.editedName, '女', '离职']) await expect(row).toContainText(text);
      await screenshot(page, testInfo, '02-user-edited.png', '用户姓名、性别和状态修改成功');
    });
    await test.step('删除临时用户并刷新验证不存在', async () => {
      await removeRecord(page, 'user', state.account, [state.account, state.editedName]);
      await reloadUsers(page, state);
      for (const name of [state.name, state.editedName]) {
        expect(await searchRecord(page, 'user', name)).not.toContain(state.account);
        await expect(recordRow(page, state.account)).toHaveCount(0);
      }
      state.userAttempted = false;
      await screenshot(page, testInfo, '03-user-deleted.png', '用户删除成功：刷新搜索无记录');
    });
    await test.step('清理本轮空角色、职位及部门', () => cleanupDependencies(page, state));
    await testInfo.attach('用户及依赖记录清理结果', {
      body: Buffer.from(JSON.stringify({ name: state.name, editedName: state.editedName, account: state.account,
        department: state.department, position: state.position, role: state.role, status: 'all-deleted' }, null, 2)),
      contentType: 'application/json'
    });
  } catch (error) {
    test.setTimeout(testInfo.timeout + 180000);
    await screenshot(page, testInfo, 'failure.png', '用户用例失败页面').catch(() => {});
    try {
      await test.step('失败时先清理用户，再清理本轮关联记录', async () => {
        if (state.userAttempted) await cleanupUser(page, state);
        await cleanupDependencies(page, state);
      });
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], `临时用户或关联记录清理失败：${state.account} / ${state.department} / ${state.position} / ${state.role}`);
    }
    throw error;
  }
});
