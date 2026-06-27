/**
 * Search and disclosure funnel coverage.
 *
 * Focuses on the public entry point: search input boundaries, keyboard-driven
 * search initiation, the first FCRA disclosure, early legal gates, back
 * navigation, and basic accessibility/layout checks before package selection.
 */
const { test, expect } = require('@playwright/test');
const {
  SEARCH_NAME,
  acceptAgeVerification,
  acceptNotice,
  expectSearchDisclosure,
  openLandingPage,
  startSearch,
  submitSearch
} = require('./helpers/funnel');
const {
  expectBasicPageAccessibility,
  expectNoHorizontalOverflow,
  tabUntilFocused
} = require('./helpers/accessibility');

test.describe('public records search and disclosure funnel', () => {
  test('blocks empty and whitespace-only searches at the landing page', async ({ page }) => {
    await openLandingPage(page);

    // Empty search should not open the disclosure dialog or leave the landing page.
    await page.locator('#people-search-btn').click();
    await expect(page.locator('#people-search-dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/$/);

    // Whitespace-only input should behave like empty input.
    await page.getByPlaceholder('Full Name').fill('   ');
    await page.locator('#people-search-btn').click();
    await expect(page.locator('#people-search-dialog')).not.toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('supports baseline accessibility and keyboard search on the landing page', async ({ page }) => {
    await openLandingPage(page);
    await expectBasicPageAccessibility(page);

    // Proves a keyboard-only user can reach the search field and submit search.
    await tabUntilFocused(page, 'input[placeholder="Full Name"]');
    await page.keyboard.type(SEARCH_NAME);

    await tabUntilFocused(page, '#people-search-btn');
    await page.keyboard.press('Enter');

    await expectSearchDisclosure(page);
  });

  test('starts a broad identity search and handles disclosure gates', async ({ page }) => {
    // First pass verifies the initial disclosure and responsive layout.
    await startSearch(page);
    await expectNoHorizontalOverflow(page);

    // Browser back should return to a usable search form, then the funnel can restart.
    await page.goBack();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible();

    await startSearch(page);
    await acceptAgeVerification(page);
    await expectNoHorizontalOverflow(page);

    await acceptNotice(page);
    await expectBasicPageAccessibility(page);
    await expect(page.locator('#oneYear')).toBeChecked();
  });

  test('keeps disclosure dialog content focusable and semantically identifiable', async ({ page }) => {
    await openLandingPage(page);
    await submitSearch(page);

    // Native dialog state matters for screen-reader and focus-management behavior.
    const searchDialog = await expectSearchDisclosure(page);
    await expect(searchDialog).toHaveJSProperty('open', true);
    await searchDialog.getByRole('link', { name: /continue/i }).focus();
    await expect(searchDialog.getByRole('link', { name: /continue/i })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/feature\/age-verification/);
    await expectBasicPageAccessibility(page);

    // The trigger's keyboard reachability is tracked in BUGS.md; this test continues
    // by opening the dialog and verifying focusable content inside it.
    await page.locator('#disclaimer-dialog-btn').click();

    const disclaimerDialog = page.locator('#disclaimer-dialog');
    await expect(disclaimerDialog).toBeVisible();
    await expect(disclaimerDialog).toHaveJSProperty('open', true);
    await disclaimerDialog.getByRole('link', { name: /i agree/i }).focus();
    await expect(disclaimerDialog.getByRole('link', { name: /i agree/i })).toBeFocused();
  });
});
