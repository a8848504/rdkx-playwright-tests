# RDKX Playwright 自动化测试工作空间

基于 Playwright 1.64.1 的本机浏览器自动化项目。业务测试位于 `outputs/playwright/`，包含公共登录和组织架构模块的增删改验证。

## 现有用例

- 部门管理：新增、编辑、删除，刷新后验证。
- 角色管理：新增、改名及停用、删除，刷新后验证。
- 职位管理：新增、修改名称和说明、删除。
- 权限管理：新增仅 root 可见的空测试菜单、修改名称、删除。
- 用户管理：创建临时用户及专用部门、职位、空权限角色，修改后依次删除全部测试记录。
- 登录状态复用：验证独立业务用例可以直接进入已登录首页。
- 本机演示测试：Chromium、Firefox、WebKit 三个浏览器的页面交互和截图。

业务测试使用随机名称，只操作本轮创建的记录；中途失败时尝试清理本轮数据。业务项目以单 worker 运行，每轮公共登录先执行一次，后续用例复用登录状态。

## 在 Windows 恢复环境

安装 Node.js 22 或满足 Playwright 要求的版本，然后在 PowerShell 执行：

```powershell
cd outputs/playwright
npm.cmd ci
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.browsers'
npx.cmd playwright install chromium firefox webkit
Copy-Item login.example.json login.local.json
```

编辑本机 `login.local.json`，填写目标系统地址、账号和密码。也可使用 `RDKX_LOGIN_URL`、`RDKX_USERNAME`、`RDKX_PASSWORD` 环境变量覆盖。

`login.local.json`、`.auth/`、浏览器组件、依赖目录和运行截图均不纳入版本控制。本仓库不包含可直接登录系统的密码或会话。

## 运行

在 `outputs/playwright/` 目录中执行：

```powershell
# 全部业务用例：每轮公共登录一次
npm.cmd run test:business

# 显示浏览器，运行全部业务用例
npm.cmd run test:business -- --headed

# 本次新增的职位、权限、用户三个用例
npm.cmd run test:new-management

# 单独运行某个模块，公共登录自动先执行一次
npm.cmd run test:department
npm.cmd run test:role
npm.cmd run test:position
npm.cmd run test:permission
npm.cmd run test:user

# 测试界面和最近一次报告
npm.cmd run ui
npm.cmd run report
```

Windows 双击入口包括 `Run-Business.cmd`、`Run-Departments.cmd`、`Run-Roles.cmd`、`Run-Positions.cmd`、`Run-Permissions.cmd`、`Run-Users.cmd`、`Run-New-Management.cmd`。这些入口保留原电脑的 Node 路径，换电脑后建议使用上面的 npm 命令，或调整脚本中的 Node 路径。

Playwright UI 模式默认不自动运行依赖项目。首次使用或会话过期时，先在项目筛选中启用 `auth` 并运行 `tests/setup/auth.setup.js`，随后运行 `rdkx` 中的业务用例。

## 新增业务用例

将 `outputs/playwright/templates/business.spec.js.example` 复制到 `outputs/playwright/tests/business/新用例.spec.js`。保留模板中的公共 `test` 导入，直接编写业务步骤，无需重复登录代码。

公共配置和页面入口位于 `support/app-config.js`、`support/app-test.js`；新管理模块共用操作位于 `support/management.js`。完整本机使用说明见 `outputs/playwright/使用说明.txt`。

## 验证记录

2026-10-18：公共登录及职位、权限、用户三个新用例在同一轮测试中共 4 项通过，测试记录和关联数据完成清理。部门、角色以及登录复用用例此前也已分别实测通过。

测试会向配置的系统实际提交新增、修改、删除操作。请使用有权测试的目标环境和账号。
