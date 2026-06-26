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
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'https://www.publicrecordsdata.us',
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
