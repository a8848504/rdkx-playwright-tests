const path = require('node:path');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '.browsers');
const { defineConfig, devices } = require('@playwright/test');
const { authFile } = require('./support/app-config');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'auth', testMatch: '**/setup/auth.setup.js', retries: 0, workers: 1,
      use: { ...devices['Desktop Chrome'], trace: 'off', video: 'off', screenshot: 'off' }
    },
    {
      name: 'rdkx', testMatch: '**/business/**/*.spec.js', dependencies: ['auth'],
      workers: 1, retries: 0, fullyParallel: false, timeout: 90000,
      use: {
        ...devices['Desktop Chrome'], storageState: authFile,
        viewport: { width: 1600, height: 1000 }, actionTimeout: 15000,
        trace: 'off', video: 'off', screenshot: 'off'
      }
    },
    { name: 'chromium', testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', testMatch: '**/smoke.spec.js', use: { ...devices['Desktop Safari'] } }
  ]
});
