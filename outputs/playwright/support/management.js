const { expect } = require('./app-test');
const { loadAppConfig } = require('./app-config');

const definitions = {
  position: { menu: '职位管理', header: '职位名称', method: 'POST', endpoint: '/post/list', urlKey: 'positionUrl', search: '请输入职位名称' },
  permission: { menu: '权限管理', header: '菜单名称', method: 'GET', endpoint: '/menu/tree/0', urlKey: 'permissionUrl' },
  user: { menu: '用户管理', header: '账号', method: 'POST', endpoint: '/user/list', urlKey: 'userUrl', search: '请输入姓名' },
  role: { menu: '角色管理', header: '角色名称', method: 'POST', endpoint: '/role/list', urlKey: 'roleUrl', search: '请输入角色名称' },
  department: { menu: '部门管理', header: '部门名称', method: 'GET', endpoint: '/dept/tree', urlKey: 'departmentUrl' }
};
const confirmName = /^确\s*(?:认|定)$/;
const cancelName = /^取\s*消$/;

function recordRow(page, name) {
  return page.getByRole('row').filter({ has: page.getByText(name, { exact: true }) });
}

async function listAfter(page, kind, action) {
  const def = definitions[kind];
  const [response] = await Promise.all([
    page.waitForResponse(r => r.request().method() === def.method
      && new URL(r.url()).pathname.endsWith(def.endpoint), { timeout: 30000 }), action()
  ]);
  expect(response.ok(), `${def.menu}列表请求应成功`).toBeTruthy();
  const payload = await response.json();
  await expect(page.getByRole('columnheader', { name: def.header, exact: true })).toBeVisible();
  return JSON.stringify(payload);
}

async function openManagement(page, kind) {
  if (await page.getByText('主菜单', { exact: true }).isVisible()) await page.getByText('主菜单', { exact: true }).click();
  const organization = page.getByRole('menuitem', { name: /^组织架构/ });
  if (await organization.getAttribute('aria-expanded') !== 'true') await page.getByText('组织架构', { exact: true }).click();
  const data = await listAfter(page, kind, () => page.getByRole('menuitem', { name: definitions[kind].menu, exact: true }).click());
  await expect(page).toHaveURL(loadAppConfig()[definitions[kind].urlKey]);
  return data;
}

async function reopenManagement(page, kind) {
  await page.goto(loadAppConfig()[definitions[kind].urlKey], { waitUntil: 'domcontentloaded' });
  return listAfter(page, kind, () => page.reload({ waitUntil: 'domcontentloaded' }));
}

async function searchRecord(page, kind, name) {
  const input = page.getByPlaceholder(definitions[kind].search, { exact: true });
  await input.fill(name);
  await expect(input).toHaveValue(name);
  return listAfter(page, kind, () => page.getByRole('button', { name: /搜索/ }).click());
}

async function fillField(dialog, placeholder, value) {
  const input = dialog.getByPlaceholder(placeholder, { exact: true });
  await input.fill(value);
  await expect(input, '提交前确认输入没有被截断').toHaveValue(value);
}

async function saveDialog(page, kind, dialog) {
  const data = await listAfter(page, kind, () => dialog.getByRole('button', { name: confirmName }).click());
  await expect(dialog).not.toBeVisible();
  return data;
}

async function cancelDialog(page, dialog) {
  await dialog.getByRole('button', { name: cancelName }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.v-modal:visible')).toHaveCount(0);
}

async function removeRecord(page, kind, name, confirmationNames = [name]) {
  const row = recordRow(page, name);
  await expect(row).toHaveCount(1, { timeout: 15000 });
  await row.getByRole('button', { name: '删除', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(1);
  const text = await dialog.innerText();
  expect(confirmationNames.some(value => text.includes(value)), '删除弹窗必须指向本次测试记录').toBeTruthy();
  await saveDialog(page, kind, dialog);
  await expect(row).toHaveCount(0, { timeout: 15000 });
}

async function screenshot(page, testInfo, filename, label) {
  if (filename !== 'failure.png') await expect(page.locator('.v-modal:visible')).toHaveCount(0);
  const file = testInfo.outputPath(filename);
  await page.screenshot({ path: file, fullPage: true, animations: 'disabled' });
  await testInfo.attach(label, { path: file, contentType: 'image/png' });
}

async function cleanupRecords(page, kind, names) {
  const initial = await reopenManagement(page, kind);
  for (const name of names) {
    const data = definitions[kind].search ? await searchRecord(page, kind, name) : initial;
    if (data.includes(name)) await removeRecord(page, kind, name);
  }
  const final = await listAfter(page, kind, () => page.reload({ waitUntil: 'domcontentloaded' }));
  for (const name of names) {
    const data = definitions[kind].search ? await searchRecord(page, kind, name) : final;
    expect(data, '清理后本次记录应不存在').not.toContain(name);
    await expect(recordRow(page, name)).toHaveCount(0);
  }
}

module.exports = { definitions, confirmName, cancelName, recordRow, listAfter, openManagement, reopenManagement,
  searchRecord, fillField, saveDialog, cancelDialog, removeRecord, screenshot, cleanupRecords };
