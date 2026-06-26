# BUGS / Audit Notes

## Ticket Audit: PR-4092 — Checkout field validation broken

Ticket claim: spaces in the credit-card field let the user proceed and should be fixed by mask regex or a blocking error.

### Sanity-check result

The ticket is not ready to implement as written. It points at a plausible risk area, but it does not provide enough detail to prove the bug or choose the right fix. Based on the current public checkout behavior, the claim that spaces alone let the user proceed appears inaccurate or at least unproven.

### Exploration performed

- Reached checkout through the observed public funnel using the single-report plan.
- Entered `4111 1111 1111 1111` in the credit-card field.
- Blurred the card field to trigger the UI mask.
- Submitted with required fields intentionally incomplete to avoid any purchase attempt.
- Checked whether the page advanced, whether the card field normalized, and which validation messages appeared.
- Also checked malformed field behavior using short card, short CVV, and invalid email values.

### Observed behavior

Entering `4111 1111 1111 1111` is normalized to `4111-1111-1111-1111` on blur. With required fields missing, the form remains on `/feature/checkout/plan3` and displays blocking validation for first name, last name, CVV, billing address, and terms. With deliberately malformed values, checkout also displays `Invalid credit card`, `Invalid CVV`, and `Invalid email`.

### Missing ticket details

- Browser, device, viewport, and environment where the issue was seen.
- Exact plan/tier selected before checkout.
- Exact card input used and whether spaces, tabs, pasted text, or non-breaking spaces were involved.
- Whether the test included valid first name, last name, email, CVV, billing address, and accepted billing terms.
- Whether "lets them proceed" means leaving the checkout page, opening a 3DS/payment challenge, creating an authorization attempt, or only passing client-side formatting.
- Expected formatting rule: strip spaces, convert spaces to hyphens, preserve grouped display, or reject spaces entirely.
- Whether the bug is client-side validation, input masking, server-side validation, or payment-provider behavior.
- Acceptance criteria for the intended fix and regression test.

### Recommended ticket rewrite

Reproduce on a named browser and plan with explicit steps, expected result, and actual result. For example: "On Firefox Nightly, single-report checkout, paste `4111 1111 1111 1111` into Card Number, fill all other required fields with safe test data except do not use a real purchasable card, click Confirm Payment. Expected: card input is either normalized consistently or a blocking validation message appears before payment authorization. Actual: page proceeds to [specific next state]."

### Audit conclusion

PR-4092 is underspecified and likely inaccurate as written. Spaces in the card field are not enough evidence that checkout proceeds. The current behavior should be captured as a regression test around normalization and blocking validation, while the ticket should be clarified before any mask-regex implementation work.

## Findings

### Missing explicit zip-code field

The brief calls out missing zip-code validation, but the checkout UI did not expose a visible zip/postal-code input. It exposes a hidden `Billing Address` search field and reports `Billing address can not be blank` after submit. This should be clarified before implementing zip-specific assertions.

### Expired card dates cannot be selected

The expiration-year dropdown begins at `26` and does not offer past years. This prevents direct expired-year boundary testing through the UI. If expired-date validation is required, the app may need a test hook, API-level test, or explicit past-year option in a non-production environment.

### Checkout reload clears partial form data

Partial checkout data entered into first name, last name, email, and card number is cleared after browser reload. This may be acceptable for payment safety, but it should be called out as the current state-resiliency behavior.

### Results sorting and pagination surface was not found

The observed broad search flow showed a search disclosure, consent gates, package selection, service agreement, and checkout. I did not encounter a separate results list with Age/Location/History sorting or pagination controls before checkout. This may indicate an A/B variant, geo-specific flow, or a missing route in the current public experience.

### Gated funnel routes can be reached directly

In a fresh browser context, `/feature/package`, `/feature/service-agreement/plan3`, and `/feature/checkout/plan3` were reachable directly without first completing search, disclosure, age-verification, notice, or service-agreement steps. Because these pages sit behind legal and payment gates in the normal funnel, direct access should be clarified or blocked before adding a hard regression test for route protection.

### Baseline accessibility structure gaps

The public funnel is missing root document language metadata (`<html lang>`). Some funnel pages also lack a visible heading or landmark structure detectable through semantic elements such as `main`, `header`, `nav`, or `footer`. The automated suite keeps keyboard operation, visible control names, image alt text, and document titles as hard assertions, while these broader structural issues are documented here as product findings.

### Age-verification agreement button is not keyboard reachable

In Firefox Nightly, repeated `Tab` navigation did not move focus to the age-verification page's visible `I Agree` button (`#disclaimer-dialog-btn`). Mouse activation opens the FCRA disclaimer dialog, and the dialog's agreement link can receive focus, but the initial age-verification trigger appears inaccessible to keyboard-only users.

### Console warnings during funnel

Repeated non-fatal warnings appeared during exploration:

- `https://www.clarity.ms/tag/null` loads with an invalid or empty MIME type.
- LiveChat JSONP endpoint loads as `text/plain`.
- Browser feature-policy warnings for unsupported `clipboard-read` / `clipboard-write`.
- A Microsoft Clarity UET script failed to load on the service-agreement page.

These did not block the tested funnel, but they create noise and should be reviewed separately from core checkout validation.
