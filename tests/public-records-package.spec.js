const { test, expect } = require('@playwright/test');
const { reachPackageSelection } = require('./helpers/funnel');
const { expectBasicPageAccessibility, expectNoHorizontalOverflow } = require('./helpers/accessibility');
const { PLANS, SINGLE_REPORT_PLAN } = require('./helpers/plans');

test.describe('public records package selection', () => {
  test('keeps the core funnel usable on a mobile viewport through package selection', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Mobile coverage stays shallow but follows real gates where layout bugs often appear.
    await reachPackageSelection(page);
    await expectNoHorizontalOverflow(page);
    await expectBasicPageAccessibility(page);

    await expect(page.locator('#oneYear')).toBeChecked();
    await page.locator(`#${SINGLE_REPORT_PLAN}`).check();
    await expect(page.locator(`#${SINGLE_REPORT_PLAN}`)).toBeChecked();
    await expect(page.locator('body')).toContainText(/one public record report/i);
  });

  test('keeps package tier selection and checkout summary in sync', async ({ page }) => {
    await reachPackageSelection(page);
    await expectBasicPageAccessibility(page);

    // Each package option should update the visible summary before the user commits.
    for (const plan of PLANS) {
      await page.locator(`#${plan.id}`).check();
      await expect(page.locator(`#${plan.id}`)).toBeChecked();
      await expect(page.locator('body')).toContainText(plan.summary);
    }

    // Continue with the single-report plan so checkout assertions have a stable price.
    await page.locator(`#${SINGLE_REPORT_PLAN}`).check();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/feature\/service-agreement\/plan3/);

    await page.getByRole('link', { name: /i agree/i }).click();
    await expect(page).toHaveURL(/\/feature\/checkout\/plan3/);
    await expect(page.locator('body')).toContainText(/\$1 one-time payment/i);
    await expect(page.locator('body')).toContainText(/payment due today: \$1/i);
  });

  test('maps package selections to expected service-agreement plan routes', async ({ page }) => {
    await reachPackageSelection(page);

    for (const plan of PLANS) {
      await page.locator(`#${plan.id}`).check();
      await page.getByRole('button', { name: /continue/i }).click();
      await expect(page).toHaveURL(plan.serviceAgreementRoute);
      await expect(page.getByText(/service agreement/i)).toBeVisible();

      await page.goBack();
      await expect(page.getByText(/choose your package/i)).toBeVisible();
    }
  });
});
