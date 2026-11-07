# User Stories and UI Route Map

## Route map

- `/login`
- `/app/overview` — role-specific dashboard
- `/app/cases` — case queue
- `/app/cases/new` — volunteer intake
- `/app/cases/:id` — case details + timeline
- `/app/review` — NGO review queue
- `/app/donor` — approved cases available to fund
- `/app/supplier` — assigned deliveries
- `/public/cases/:publicRef` — public-safe transparency receipt
- `/settings/demo` — demo setup/status; admin only

## User stories

### Field volunteer

- As a volunteer, I can submit a plain-language request without needing the beneficiary to connect a wallet.
- As a volunteer, I can see AI-extracted details and correct mistakes before review.
- As a volunteer, I can see whether more information is needed.

### NGO reviewer

- As a reviewer, I can compare possible duplicate requests and record my decision.
- As a reviewer, I can approve a case with a confirmed amount, supplier wallet and expiry.
- As a reviewer, I can inspect delivery evidence and decide whether to authorize release.

### Donor

- As a donor, I can see a public-safe summary of an approved case.
- As a donor, I can review the demo token, exact amount, network and destination before signing.
- As a donor, I can verify the funding transaction.

### Supplier

- As a supplier, I can view a delivery request assigned to my organization.
- As a supplier, I can submit an invoice/delivery report.
- As a supplier, I can verify settlement to my configured wallet.

### Public viewer

- As a viewer, I can verify the on-chain status without seeing beneficiary identity or private evidence.
