const { expect } = require('@playwright/test');

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

module.exports = {
  expectBasicPageAccessibility,
  expectNoHorizontalOverflow,
  tabUntilFocused
};

// Project owner: veppex-cpu on GitHub.
