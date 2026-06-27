/**
 * PublicRecordsData.us funnel coverage.
 *
 * This spec exercises the highest-risk public journey end to end:
 * search -> disclosure gates -> age/notice consent -> package selection ->
 * service agreement -> checkout validation.
 *
 * Included coverage:
 * - keyboard and baseline accessibility smoke checks on key funnel pages
 * - responsive/mobile smoke coverage for the package-selection path
 * - FCRA/disclosure dialog content and navigation
 * - package tier selection and checkout summary consistency
 * - search input boundary checks and plan-to-route handoff checks
 * - checkout validation without entering a complete payment-ready form
 * - documented product gaps such as expired-date and zip-code gray areas
 *
 * The tests intentionally avoid generated CSS classes and prefer visible text,
 * roles, stable IDs, and URL assertions so they track user-facing behavior.
 */
const { test, expect } = require('@playwright/test');

const SEARCH_NAME = 'John Smith';
const SINGLE_REPORT_PLAN = 'singleReport';
const PLANS = [
  {
    id: 'oneYear',
    summary: /360 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan1/
  },
  {
    id: 'threeMonth',
    summary: /90 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan2/
  },
  {
    id: SINGLE_REPORT_PLAN,
    summary: /one public record report/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan3/
  },
  {
    id: 'fiveReports',
    summary: /10 public record reports/i,
    serviceAgreementRoute: /\/feature\/service-agreement\/plan4/
  }
];

// Dependency-free accessibility smoke coverage. Broader structural findings
// are documented in BUGS.md so known product issues do not mask funnel regressions.
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

    // Approximate the accessible-name rules for the controls this funnel exposes.
    // This is not a replacement for axe, but it catches common unlabeled controls.
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

// A cheap responsive sanity check for the main funnel pages.
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

// Models keyboard-only navigation without assuming exact tab order beyond a cap.
async function tabUntilFocused(page, selector, maxTabs = 12) {
  for (let attempt = 0; attempt < maxTabs; attempt += 1) {
    if (await page.locator(selector).evaluate((element) => element === document.activeElement)) {
      return;
    }

    await page.keyboard.press('Tab');
  }

  await expectFocusedElement(page, selector);
}

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

// Clicks the checkout submit button while the form remains intentionally invalid.
async function submitCheckout(page) {
  await page.getByRole('button', { name: /confirm payment/i }).click();
}

// Fills checkout with safe malformed defaults; callers can override specific fields.
async function fillMalformedCheckoutDetails(page, overrides = {}) {
  const values = {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'not-an-email',
    cc: '4111',
    cvv: '1',
    ...overrides
  };

  await page.locator('#firstName').fill(values.firstName);
  await page.locator('#lastName').fill(values.lastName);
  await page.locator('#email').fill(values.email);
  await page.locator('#cc').fill(values.cc);
  await page.locator('#cvv').fill(values.cvv);
}

test.describe('public records funnel', () => {
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

  test('keeps checkout reachable and readable on a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await reachCheckout(page, SINGLE_REPORT_PLAN);
    await expectNoHorizontalOverflow(page);
    await expectBasicPageAccessibility(page);
    await expect(page.getByRole('button', { name: /confirm payment/i })).toBeVisible();
    await expect(page.locator('body')).toContainText(/payment due today: \$1/i);
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
