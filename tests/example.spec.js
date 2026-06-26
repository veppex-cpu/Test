const { test, expect } = require('@playwright/test');

test('loads the Playwright homepage', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  await expect(page).toHaveTitle(/Playwright/);
});
