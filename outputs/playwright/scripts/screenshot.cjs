const path = require('node:path');
const { pathToFileURL } = require('node:url');
process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(__dirname, '../.browsers');
const { chromium } = require('playwright');
const fs = require('node:fs/promises');

(async () => {
  const url = process.argv[2] || pathToFileURL(path.join(__dirname, '../demo.html')).href;
  const output = path.resolve(process.argv[3] || path.join(__dirname, '../screenshots/page.png'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await fs.mkdir(path.dirname(output), { recursive: true });
    await page.screenshot({ path: output, fullPage: true });
    console.log(JSON.stringify({ url: page.url(), title: await page.title(), screenshot: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
