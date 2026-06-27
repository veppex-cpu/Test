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

module.exports = {
  fillMalformedCheckoutDetails,
  submitCheckout
};
