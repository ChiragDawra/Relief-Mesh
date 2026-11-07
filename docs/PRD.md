# Product Requirements Document — ReliefMesh

**Version:** 1.0 · **Status:** Hackathon MVP specification · **Date:** 6 November 2026

## 1. Executive summary

ReliefMesh is an AI-assisted coordination and transparent disbursement prototype for local relief organizations. It converts unstructured emergency-aid requests into structured cases, helps coordinators spot potential duplicates and review delivery evidence, and uses a Solana Devnet escrow program to record the funding and settlement of a case-specific supplier payment.

ReliefMesh is not a beneficiary identity system, aid eligibility oracle, emergency-response authority or replacement for established humanitarian platforms. Its MVP demonstrates how small organizations could coordinate a narrow, auditable aid workflow.

## 2. Problem statement

During emergencies, requests can arrive through forms, chat messages, calls and field reports. Small organizations may have fragmented records, incomplete information, overlapping requests and weak links between a donor's contribution and the final supplier payment. The resulting work is often manual and difficult to reconcile.

**Product hypothesis:** A shared case workflow, AI-assisted information processing and programmable low-cost settlement can reduce administrative friction and make a narrow aid-disbursement lifecycle easier to review.

This hypothesis must be presented as something the prototype demonstrates, not as a proven impact claim. No real-world reduction in fraud, duplication or delivery time should be claimed from a synthetic demo.

## 3. Target users and personas

| Persona | Job to be done | MVP permissions |
|---|---|---|
| Field volunteer | Submit a request with enough context for review | Create cases for assigned organization; add notes/evidence |
| NGO reviewer | Triage requests, resolve duplicate suggestions, approve cases and verify delivery | Review organization cases; approve/flag; verify delivery |
| Donor | Fund an approved case and confirm where the funds went | View public-safe case summary; fund a case; view chain receipt |
| Supplier | Submit invoice/delivery evidence and receive settlement | View assigned delivery request; submit evidence; receive tokens |
| Admin | Configure demo organizations, users and token mint | Demo-only management; no hidden override of chain rules |

## 4. Product principles

1. **Human accountable:** consequential decisions require a named, authorized human signer/reviewer.
2. **AI is advisory:** extraction, prioritization and duplicate matching are assistive, explainable and reversible.
3. **Privacy by default:** personal data and documents remain off-chain and access-controlled.
4. **Verifiable settlement:** a funding/release claim must link to a confirmed Devnet transaction and expected program state.
5. **Honest prototype:** all people, organizations, locations, requests and documents are synthetic; demo tokens have no cash value.
6. **Inclusive input:** accept plain-language requests and allow a volunteer to submit on behalf of someone without requiring the beneficiary to use a wallet.

## 5. Goals

### P0 — must ship

- Create and view a synthetic relief request.
- Extract structured category, location label, household count, urgency, requested items and amount from a plain-language request.
- Show AI confidence, missing fields and reasoning.
- Detect and display likely duplicate candidates without merging/rejecting them.
- Allow an authorized NGO reviewer to approve or flag a case.
- Create a case-specific Anchor escrow on Solana Devnet.
- Allow a donor wallet to fund the exact target amount using a clearly labelled demo SPL token.
- Allow a supplier to submit a synthetic invoice/delivery note.
- Allow an authorized NGO wallet to verify delivery and release escrow tokens to the configured supplier.
- Show confirmed transaction signatures and the case timeline.
- Enforce role checks and protect personal data off-chain.

### P1 — only after P0 is stable

- AI extraction from one image/PDF invoice with a clear human review screen.
- Similarity search using multilingual embeddings and a tunable threshold.
- A map of synthetic aid locations.
- Expiry refund flow with tests and UI.
- Public aggregate statistics that reveal no beneficiary identity.

### P2 — explicitly out of hackathon scope

- Mainnet or real donations.
- Production KYC/AML, legal/compliance workflows or regulated payment operations.
- Real disaster response, real beneficiary enrollment or medical information.
- Autonomous AI approval or autonomous wallet signing.
- Multi-donor split funding, pooled treasury, multi-sig governance and cross-chain payments.
- Native mobile app, push notifications, offline synchronization and full logistics routing.

## 6. Core user journeys

### Journey A — Submit and triage a request

1. Field volunteer signs in and chooses their organization.
2. They enter a plain-language description, synthetic locality and optional requested-items list.
3. API saves a `submitted` case before AI processing, so AI failure never loses the request.
4. AI returns a structured draft, missing fields, urgency recommendation, confidence and possible duplicate candidates.
5. Volunteer reviews extracted fields and submits corrections.
6. NGO reviewer sees the case in a review queue.

### Journey B — Approve and fund a case

1. NGO reviewer reviews the request and AI suggestions.
2. Reviewer approves the case and confirms supplier wallet, token mint, amount and expiry.
3. Backend prepares/records escrow metadata; frontend asks the reviewer wallet to sign the create-case instruction.
4. Donor connects a wallet and reviews a clear funding summary.
5. Donor signs the exact demo-token transfer into the PDA-controlled escrow vault.
6. Frontend verifies the confirmed transaction and the escrow account state.

### Journey C — Submit and verify delivery

1. Supplier signs in and sees assigned case requirements.
2. Supplier submits synthetic invoice and delivery note (or structured demo form).
3. AI extracts invoice fields and highlights differences from the approved amount/items.
4. NGO reviewer inspects the original evidence and AI findings.
5. Reviewer confirms delivery using their authorized wallet.
6. Anchor program releases escrow tokens to the pre-configured supplier token account.
7. Case timeline shows the release signature, amount and explorer link.

## 7. Functional requirements

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---:|---|
| FR-01 | Authenticated role-aware access | P0 | API rejects missing/invalid JWT and unauthorized role; UI routes are not the only protection |
| FR-02 | Create relief case | P0 | Valid request persists; schema rejects missing/invalid category, amount or locality label |
| FR-03 | AI intake extraction | P0 | Returns schema-valid JSON, uncertainty and missing fields; failure falls back to saved case + manual review |
| FR-04 | Duplicate suggestions | P0 | Returns up to 3 candidates with score/reasons; never auto-merges or auto-rejects |
| FR-05 | Human case review | P0 | Only NGO reviewer for owning organization can approve/flag; decision is audited |
| FR-06 | Create escrow | P0 | On-chain case PDA ties opaque case hash to authority, supplier, mint, exact amount and expiry |
| FR-07 | Fund escrow | P0 | Donor signs transaction; amount and mint are checked; on-chain state becomes `Funded` |
| FR-08 | Delivery submission | P0 | Assigned supplier can submit evidence metadata and protected files; event is audited |
| FR-09 | Human delivery verification | P0 | Authorized NGO authority signs release; evidence hash is recorded; wrong signer is rejected |
| FR-10 | Settlement proof | P0 | UI fetches confirmed signature and escrow state; link opens Solana Devnet Explorer |
| FR-11 | Audit timeline | P0 | Shows timestamp, actor role, event, human/AI distinction and transaction signature where applicable |
| FR-12 | Privacy boundaries | P0 | No names, phone numbers, exact addresses, documents or personal data appear in on-chain account data/events |
| FR-13 | Expiry refund | P1 | Only recorded donor can reclaim funded amount after expiry if still funded |
| FR-14 | Public aggregate dashboard | P1 | Only totals and pseudonymous case references are public |

## 8. Case lifecycle and allowed transitions

Application status and on-chain escrow status are related but not identical. Keep them as separate fields.

**Application status:**

`submitted → needs_information → under_review → approved → funded → delivery_submitted → delivery_verified → completed`

Other terminal/exception statuses: `flagged`, `cancelled`, `expired`, `rejected`.

**Allowed application transitions:**

- `submitted → needs_information | under_review | flagged`
- `needs_information → submitted | under_review | flagged`
- `under_review → approved | needs_information | flagged | rejected`
- `approved → funded | cancelled`
- `funded → delivery_submitted | expired`
- `delivery_submitted → delivery_verified | funded` (request correction)
- `delivery_verified → completed` only after chain release is confirmed

Do not mark `completed` because a release transaction was merely submitted. Require confirmed transaction + matching on-chain status.

**On-chain status:** `Created → Funded → Released`, or `Funded → Refunded` after expiry. Do not create a separate on-chain `Verified` state unless the program specification explicitly adds it; the release instruction itself is the authority-signed verification action.

## 9. AI behavior and explainability

- AI returns structured fields, confidence, uncertainties, and evidence references.
- A duplicate score is a ranking signal, not a fraud probability.
- The UI must say `Possible duplicate — review required`, not `Fraud detected`.
- A priority score is a recommendation, not a denial/eligibility decision.
- Evidence AI reports mismatches and missing evidence; it cannot prove physical delivery.
- Always show `AI-assisted; human decision required` next to AI-generated findings.

## 10. Non-functional requirements

- P0 dashboard routes should load in under 3 seconds on a normal broadband connection after initial bundle load (target, not guarantee).
- API errors must be actionable and use consistent error codes.
- All state-changing endpoints must enforce authorization server-side.
- Smart-contract instructions must have explicit signer, mint, status, amount and account ownership checks.
- The app must remain usable if the AI service is unavailable: save request and allow manual review.
- Demo reset must restore known synthetic data and must never reset or expose user wallet keys.
- All dates stored in UTC; UI formats local time.

## 11. Hackathon demo success metrics

For a rehearsed synthetic scenario, measure:

- 1 request submitted and persisted.
- 1 AI triage result generated with visible confidence and uncertainty.
- 1 duplicate candidate surfaced and manually reviewed.
- 1 human approval recorded.
- 1 donor funding transaction confirmed on Devnet.
- 1 delivery evidence review completed by a human.
- 1 release transaction confirmed on Devnet.
- 0 PII fields found in on-chain account/event payloads.

These are prototype completion metrics, not real-world humanitarian impact metrics.

## 12. Out of scope and assumptions

- The demo uses a fictitious flood-response scenario and invented cases/organizations.
- Demo token is minted for testing and is not redeemable.
- A demo supplier wallet is controlled by a team member or a dedicated demo keypair kept locally; the app never stores that key.
- Legal, humanitarian protection, data residency, KYC/AML, safeguarding and operational audits are not solved by this prototype.
- Any real deployment would require humanitarian partners, legal review, local safeguarding protocols, privacy impact assessment and independent security review.

## 13. Definition of MVP done

The MVP is done only when an evaluator can follow a seeded case from request intake through AI suggestions, human review, actual Devnet funding, delivery review, authorized on-chain release and transaction verification, with no manual database edits required during the demonstration.
