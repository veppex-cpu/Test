# BUGS / Audit Notes

## Ticket Audit: PR-4092 — Checkout field validation broken

Ticket claim: spaces in the credit-card field let the user proceed and should be fixed by mask regex or a blocking error.

Observed behavior: entering `4111 1111 1111 1111` is normalized to `4111-1111-1111-1111` on blur. With required fields missing, the form remains on `/feature/checkout/plan3` and displays blocking validation for first name, last name, CVV, billing address, and terms.

Audit conclusion: the ticket is underspecified and likely inaccurate as written. It does not define browser, plan, exact card input, whether the terms checkbox was checked, whether the submit reached payment authorization, or expected normalization rules. Based on exploration, spaces alone are not enough evidence that checkout proceeds.

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
