const { expect } = require('@playwright/test');

const SEARCH_NAME = 'John Smith';

// Opens the public landing page and waits until the search form is ready to use.
async function openLandingPage(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByPlaceholder('Full Name')).toBeVisible();
  await expect(page.locator('#people-search-btn')).toBeVisible();
  await expect(page.locator('#people-search-btn')).toBeEnabled();
}

// Submits the people-search form with a broad default identity query.
async function submitSearch(page, name = SEARCH_NAME) {
  await page.getByPlaceholder('Full Name').fill(name);
  await page.locator('#people-search-btn').click();
}

// Verifies the initial search disclosure dialog and returns it for follow-up actions.
async function expectSearchDisclosure(page) {
  const disclosureDialog = page.locator('#people-search-dialog');
  await expect(disclosureDialog).toBeVisible();
  await expect(disclosureDialog).toContainText(/200 public records/i);
  await expect(disclosureDialog).toContainText(/FCRA/i);
  return disclosureDialog;
}

// Starts from the public landing page and verifies the first FCRA disclosure gate.
async function startSearch(page) {
  await openLandingPage(page);
  await expect(page).toHaveTitle(/Public Records Search/);

  await submitSearch(page);

  const disclosureDialog = await expectSearchDisclosure(page);
  await disclosureDialog.getByRole('link', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/feature\/age-verification/);
}

// Accepts the age-verification gate and verifies the nested FCRA disclaimer.
async function acceptAgeVerification(page) {
  await expect(page.getByText(/public records/i).first()).toBeVisible();
  await expect(page.locator('body')).toContainText(/terms of service/i);

  await page.locator('#disclaimer-dialog-btn').click();

  const disclaimerDialog = page.locator('#disclaimer-dialog');
  await expect(disclaimerDialog).toBeVisible();
  await expect(disclaimerDialog).toContainText(/Fair Credit Reporting Act/i);

  await disclaimerDialog.getByRole('link', { name: /i agree/i }).click();
  await expect(page).toHaveURL(/\/feature\/notice/);
}

// Completes the final notice page before the package matrix.
async function acceptNotice(page) {
  await expect(page.getByText(/important notice/i)).toBeVisible();
  await page.getByRole('link', { name: /i agree/i }).click();
  await expect(page).toHaveURL(/\/feature\/package/);
}

// Shared setup for tests that need to begin at package selection.
async function reachPackageSelection(page) {
  await startSearch(page);
  await acceptAgeVerification(page);
  await acceptNotice(page);
  await expect(page.getByText(/choose your package/i)).toBeVisible();
}

// Shared setup for checkout tests. The helper stops before entering valid payment data.
async function reachCheckout(page, plan) {
  await reachPackageSelection(page);
  await page.locator(`#${plan}`).check();
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/feature\/service-agreement\/plan\d+/);
  await expect(page.getByText(/service agreement/i)).toBeVisible();
  await page.getByRole('link', { name: /i agree/i }).click();

  await expect(page).toHaveURL(/\/feature\/checkout\/plan\d+/);
  await expect(page.getByRole('button', { name: /confirm payment/i })).toBeVisible();
}

module.exports = {
  SEARCH_NAME,
  acceptAgeVerification,
  acceptNotice,
  expectSearchDisclosure,
  openLandingPage,
  reachCheckout,
  reachPackageSelection,
  startSearch,
  submitSearch
};

// Project owner: veppex-cpu on GitHub.
