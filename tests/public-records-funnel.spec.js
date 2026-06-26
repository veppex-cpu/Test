const { test, expect } = require('@playwright/test');

const SEARCH_NAME = 'John Smith';

async function expectBasicPageAccessibility(page) {
  const issues = await page.evaluate(() => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      return (
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        (element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0)
      );
    };

    const getTextById = (id) => document.getElementById(id)?.textContent?.trim() || '';

    const hasAccessibleName = (element) => {
      const tagName = element.tagName.toLowerCase();
      const type = element.getAttribute('type');

      if (tagName === 'input' && type === 'hidden') {
        return true;
      }

      const ariaLabel = element.getAttribute('aria-label')?.trim();
      const ariaLabelledBy = element
        .getAttribute('aria-labelledby')
        ?.split(/\s+/)
        .map(getTextById)
        .join(' ')
        .trim();
      const label = element.id
        ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent?.trim()
        : '';
      const wrappedLabel = element.closest('label')?.textContent?.trim();
      const nativeText = element.textContent?.trim();
      const placeholder = element.getAttribute('placeholder')?.trim();
      const value = element.getAttribute('value')?.trim();

      return Boolean(ariaLabel || ariaLabelledBy || label || wrappedLabel || nativeText || placeholder || value);
    };

    const visibleControls = Array.from(
      document.querySelectorAll('a[href], button, input, select, textarea')
    ).filter((element) => isVisible(element) && !element.disabled);

    const unnamedControls = visibleControls
      .filter((element) => !hasAccessibleName(element))
      .map((element) => element.outerHTML.slice(0, 160));

    const missingAltImages = Array.from(document.querySelectorAll('img'))
      .filter((image) => isVisible(image) && !image.hasAttribute('alt'))
      .map((image) => image.outerHTML.slice(0, 160));

    return {
      missingDocumentTitle: !document.title.trim(),
      missingLanguage: !document.documentElement.lang,
      missingHeading: !document.querySelector('h1, h2'),
      missingLandmark: !document.querySelector('main, [role="main"], header, nav, footer'),
      unnamedControls,
      missingAltImages
    };
  });

  expect(issues.missingDocumentTitle).toBe(false);
  expect(issues.unnamedControls).toEqual([]);
  expect(issues.missingAltImages).toEqual([]);
}

async function expectNoHorizontalOverflow(page) {
  const overflow = await page.evaluate(() => {
    const documentWidth = document.documentElement.scrollWidth;
    return documentWidth - window.innerWidth;
  });

  expect(overflow).toBeLessThanOrEqual(2);
}

async function expectFocusedElement(page, selector) {
  await expect(page.locator(selector)).toBeFocused();
}

async function tabUntilFocused(page, selector, maxTabs = 12) {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    if (await page.locator(selector).evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  await expectFocusedElement(page, selector);
}

async function startSearch(page) {
  await page.goto('/');
  await expect(page.getByPlaceholder('Full Name')).toBeVisible();
  await expect(page).toHaveTitle(/Public Records Search/);

  await page.getByPlaceholder('Full Name').fill(SEARCH_NAME);
  await page.locator('#people-search-btn').click();

  const disclosureDialog = page.locator('#people-search-dialog');
  await expect(disclosureDialog).toBeVisible();
  await expect(disclosureDialog).toContainText(/200 public records/i);
  await expect(disclosureDialog).toContainText(/FCRA/i);

  await disclosureDialog.getByRole('link', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/feature\/age-verification/);
}

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

async function acceptNotice(page) {
  await expect(page.getByText(/important notice/i)).toBeVisible();
  await page.getByRole('link', { name: /i agree/i }).click();
  await expect(page).toHaveURL(/\/feature\/package/);
}

async function reachPackageSelection(page) {
  await startSearch(page);
  await acceptAgeVerification(page);
  await acceptNotice(page);
  await expect(page.getByText(/choose your package/i)).toBeVisible();
}

async function reachCheckout(page, plan = 'singleReport') {
  await reachPackageSelection(page);
  await page.locator(`#${plan}`).check();
  await page.getByRole('button', { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/feature\/service-agreement\/plan\d+/);
  await expect(page.getByText(/service agreement/i)).toBeVisible();
  await page.getByRole('link', { name: /i agree/i }).click();

  await expect(page).toHaveURL(/\/feature\/checkout\/plan\d+/);
  await expect(page.getByRole('button', { name: /confirm payment/i })).toBeVisible();
}

test.describe('public records funnel', () => {
  test('supports baseline accessibility and keyboard search on the landing page', async ({ page }) => {
    await page.goto('/');
    await expectBasicPageAccessibility(page);

    await tabUntilFocused(page, 'input[placeholder="Full Name"]');
    await page.keyboard.type(SEARCH_NAME);

    await tabUntilFocused(page, '#people-search-btn');
    await page.keyboard.press('Enter');

    const disclosureDialog = page.locator('#people-search-dialog');
    await expect(disclosureDialog).toBeVisible();
    await expect(disclosureDialog).toContainText(/FCRA/i);
    await expect(disclosureDialog).toContainText(/200 public records/i);
  });

  test('starts a broad identity search and handles disclosure gates', async ({ page }) => {
    await startSearch(page);
    await expectNoHorizontalOverflow(page);

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
    await page.goto('/');
    await page.getByPlaceholder('Full Name').fill(SEARCH_NAME);
    await page.locator('#people-search-btn').click();

    const searchDialog = page.locator('#people-search-dialog');
    await expect(searchDialog).toBeVisible();
    await expect(searchDialog).toHaveJSProperty('open', true);
    await searchDialog.getByRole('link', { name: /continue/i }).focus();
    await expect(searchDialog.getByRole('link', { name: /continue/i })).toBeFocused();
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(/\/feature\/age-verification/);
    await expectBasicPageAccessibility(page);

    await page.locator('#disclaimer-dialog-btn').click();

    const disclaimerDialog = page.locator('#disclaimer-dialog');
    await expect(disclaimerDialog).toBeVisible();
    await expect(disclaimerDialog).toHaveJSProperty('open', true);
    await disclaimerDialog.getByRole('link', { name: /i agree/i }).focus();
    await expect(disclaimerDialog.getByRole('link', { name: /i agree/i })).toBeFocused();
  });

  test('keeps package tier selection and checkout summary in sync', async ({ page }) => {
    await reachPackageSelection(page);
    await expectBasicPageAccessibility(page);

    const plans = [
      { id: 'oneYear', summary: /360 public record reports/i },
      { id: 'threeMonth', summary: /90 public record reports/i },
      { id: 'singleReport', summary: /one public record report/i },
      { id: 'fiveReports', summary: /10 public record reports/i }
    ];

    for (const plan of plans) {
      await page.locator(`#${plan.id}`).check();
      await expect(page.locator(`#${plan.id}`)).toBeChecked();
      await expect(page.locator('body')).toContainText(plan.summary);
    }

    await page.locator('#singleReport').check();
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/feature\/service-agreement\/plan3/);

    await page.getByRole('link', { name: /i agree/i }).click();
    await expect(page).toHaveURL(/\/feature\/checkout\/plan3/);
    await expect(page.locator('body')).toContainText(/\$1 one-time payment/i);
    await expect(page.locator('body')).toContainText(/payment due today: \$1/i);
  });

  test('validates checkout fields without submitting a purchase', async ({ page }) => {
    await reachCheckout(page, 'singleReport');
    await expectBasicPageAccessibility(page);

    await page.locator('#cc').fill('4111 1111 1111 1111');
    await page.locator('#cc').blur();
    await expect(page.locator('#cc')).toHaveValue('4111-1111-1111-1111');

    const selectableYears = await page.locator('#year option').evaluateAll((options) =>
      options.map((option) => Number(option.value))
    );
    expect(Math.min(...selectableYears)).toBeGreaterThanOrEqual(26);

    await page.getByRole('button', { name: /confirm payment/i }).click();

    await expect(page.locator('body')).toContainText(/first name must include/i);
    await expect(page.locator('body')).toContainText(/last name must include/i);
    await expect(page.locator('body')).toContainText(/invalid cvv/i);
    await expect(page.locator('body')).toContainText(/you must agree to the terms/i);
    await expect(page.locator('#address-search-error-message')).toContainText(
      /billing address can not be blank/i
    );

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
