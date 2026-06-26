// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const os = require('node:os');
const path = require('node:path');

const nightlyExecutablePath = path.join(
  os.homedir(),
  'Library/Caches/ms-playwright/firefox-1532/firefox/Nightly.app/Contents/MacOS/firefox'
);

module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'nightly',
      use: {
        ...devices['Desktop Firefox'],
        browserName: 'firefox',
        launchOptions: {
          executablePath: nightlyExecutablePath
        }
      }
    }
  ]
});
