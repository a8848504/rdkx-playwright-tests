const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const authDir = path.join(root, '.auth');
const authFile = path.join(authDir, 'admin.json');
const sessionFile = path.join(authDir, 'session.json');

function loadAppConfig() {
  const localPath = path.join(root, 'login.local.json');
  const local = fs.existsSync(localPath)
    ? JSON.parse(fs.readFileSync(localPath, 'utf8').replace(/^\uFEFF/, '')) : {};
  const loginUrl = process.env.RDKX_LOGIN_URL || local.url;
  if (!loginUrl) throw new Error('请在 login.local.json 或 RDKX_LOGIN_URL 中填写登录地址。');
  const home = new URL(loginUrl);
  home.hash = '/rotateDevSystem/analysis/index';
  const department = new URL(loginUrl);
  department.hash = '/rotateDevSystem/org/deptManage';
  const role = new URL(loginUrl);
  role.hash = '/rotateDevSystem/org/roleManage';
  const position = new URL(loginUrl);
  position.hash = '/rotateDevSystem//branchManage';
  const permission = new URL(loginUrl);
  permission.hash = '/rotateDevSystem/org/menuManage';
  const user = new URL(loginUrl);
  user.hash = '/rotateDevSystem/org/userManage';
  return {
    loginUrl, homeUrl: home.href, departmentUrl: department.href, roleUrl: role.href,
    positionUrl: position.href, permissionUrl: permission.href, userUrl: user.href,
    username: process.env.RDKX_USERNAME || local.username,
    password: process.env.RDKX_PASSWORD || local.password
  };
}

module.exports = { loadAppConfig, authDir, authFile, sessionFile };
