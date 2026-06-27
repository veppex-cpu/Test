const { test, expect } = require('@playwright/test');
const { fillMalformedCheckoutDetails, submitCheckout } = require('./helpers/checkout');
const { reachCheckout, reachPackageSelection } = require('./helpers/funnel');
const { expectBasicPageAccessibility, expectNoHorizontalOverflow } = require('./helpers/accessibility');
const { SINGLE_REPORT_PLAN } = require('./helpers/plans');

test.describe('public records checkout validation', () => {
  test('requires service agreement acceptance before checkout', async ({ page }) => {
    await reachPackageSelection(page);

    await page.locator(`#${SINGLE_REPORT_PLAN}`).check();
    await page.getByRole('button', { name: /continue/i }).click();

    await expect(page).toHaveURL(/\/feature\/service-agreement\/plan3/);
    await expect(page.getByText(/service agreement/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /confirm payment/i })).not.toBeVisible();

    await page.getByRole('link', { name: /i agree/i }).click();
    await expect(page).toHaveURL(/\/feature\/checkout\/plan3/);
    await expect(page.getByRole('button', { name: /confirm payment/i })).toBeVisible();
  });

  test('keeps checkout reachable and readable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await reachCheckout(page, SINGLE_REPORT_PLAN);
    await expectNoHorizontalOverflow(page);
    await expectBasicPageAccessibility(page);
    await expect(page.getByRole('button', { name: /confirm payment/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/payment due today: \$1/i);
  });

  test('shows field-specific checkout errors for malformed payment details', async ({ page }) => {
    await reachCheckout(page, SINGLE_REPORT_PLAN);

    // These values are intentionally malformed and still leave address/terms incomplete.
    await fillMalformedCheckoutDetails(page);
    await submitCheckout(page);

    await expect(page.locator('body')).toContainText(/invalid credit card/i);
    await expect(page.locator('body')).toContainText(/invalid cvv/i);
    await expect(page.locator('body')).toContainText(/invalid email/i);
    await expect(page.locator('body')).toContainText(/you must agree to the terms/i);
    await expect(page).toHaveURL(/\/feature\/checkout\/plan3/);
  });

  test('flags an expired month when the current expiration year is selected', async ({ page }) => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    test.skip(currentMonth === 1, 'No prior month exists in January for this current-year boundary check.');

    const currentYear = String(now.getFullYear()).slice(-2);
    const expiredMonth = String(currentMonth - 1).padStart(2, '0');

    await reachCheckout(page, SINGLE_REPORT_PLAN);

    // Past years are hidden, but past months in the current year remain selectable.
    await page.locator('#month').selectOption(expiredMonth);
    await page.locator('#year').selectOption(currentYear);
    await fillMalformedCheckoutDetails(page);

    await submitCheckout(page);

    await expect(page.locator('body')).toContainText(/invalid year/i);
    await expect(page).toHaveURL(/\/feature\/checkout\/plan3/);
  });

  test('validates checkout fields without submitting a purchase', async ({ page }) => {
    await reachCheckout(page, SINGLE_REPORT_PLAN);
    await expectBasicPageAccessibility(page);

    // This audits the reported card-spacing issue without creating a valid purchase.
    await page.locator('#cc').fill('4111 1111 1111 1111');
    await page.locator('#cc').blur();
    await expect(page.locator('#cc')).toHaveValue('4111-1111-1111-1111');

    // Past years are not selectable; current-year past months are covered separately.
    const selectableYears = await page.locator('#year option').evaluateAll((options) =>
      options.map((option) => Number(option.value))
    );
    expect(Math.min(...selectableYears)).toBeGreaterThanOrEqual(26);

    // Submit with required fields intentionally missing to verify blocking validation.
    await submitCheckout(page);

    await expect(page.locator('body')).toContainText(/first name must include/i);
    await expect(page.locator('body')).toContainText(/last name must include/i);
    await expect(page.locator('body')).toContainText(/invalid cvv/i);
    await expect(page.locator('body')).toContainText(/you must agree to the terms/i);
    await expect(page.locator('#address-search-error-message')).toContainText(
      /billing address can not be blank/i
    );

    // Reload behavior is documented because checkout forms often preserve state.
    await page.locator('#firstName').fill('Ada');
    await page.locator('#lastName').fill('Lovelace');
    await page.locator('#email').fill('ada@example.com');
    await page.reload();

    await expect(page.locator('#firstName')).toHaveValue('');
    await expect(page.locator('#lastName')).toHaveValue('');
    await expect(page.locator('#email')).toHaveValue('');
    await expect(page.locator('#cc')).toHaveValue('');
  });
});
