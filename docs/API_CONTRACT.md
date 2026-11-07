# REST API Contract — ReliefMesh

**Base path:** `/api/v1`  
**Auth:** `Authorization: Bearer <Supabase access token>` except explicitly public health/public transparency routes.  
**Content type:** `application/json` unless uploading multipart evidence.

## 1. Common conventions

- Validate all request bodies, params and query strings with Zod.
- API resolves `user_id`, memberships and roles from verified auth context; never trust role or organization IDs supplied by client.
- Use UUIDs for internal IDs and `public_ref` for display.
- Use integer base-unit strings for token amounts in JSON because JavaScript numbers cannot exactly represent every 64-bit integer.
- Every state-changing request returns the updated resource and an audit event ID.

### Error shape

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to review this case.",
    "request_id": "req_..."
  }
}
```

HTTP codes: `400` invalid input, `401` unauthenticated, `403` unauthorized, `404` absent/not visible, `409` invalid state/conflict, `422` semantically invalid, `429` rate limited, `500` internal, `503` dependent service unavailable.

## 2. Health and current user

### `GET /health`

Returns service health only; no secret/config values.

### `GET /me`

Returns profile and verified memberships/roles for the authenticated user.

### `GET /suppliers`

Role: `ngo_reviewer` or `admin`. Returns supplier organizations with their registered supplier wallet public keys (ADR-011).

## 3. Cases

### `POST /cases`

Create a case first; AI runs after persistence.

Request:
```json
{
  "organization_id": "uuid",
  "description": "Synthetic demo request text",
  "locality_label": "Demo Ward 4",
  "requested_amount_base_units": "25000000",
  "token_decimals": 6,
  "category_hint": "water"
}
```

Response `201`:
```json
{
  "case": {
    "id": "uuid",
    "public_ref": "RM-DEMO-1042",
    "application_status": "submitted",
    "ai_status": "pending",
    "case_ref_hash": "64-hex-character-sha256"
  }
}
```

Server calculates `case_ref_hash` from a cryptographically random opaque value or UUID namespace; never hash PII.

### `GET /cases`

Query: `status`, `category`, `organization_id` (only if caller is a member), `limit`, `cursor`. Server scopes rows to caller role.

### `GET /cases/:caseId`

Returns authorized case detail, latest AI assessment and status timeline. Donor/public view must use a separate safe projection.

### `PATCH /cases/:caseId`

Field-worker editable fields while case is `submitted` or `needs_information` only. No arbitrary status mutation.

Request example:
```json
{
  "category": "water",
  "household_count": 5,
  "requested_items": [{"name":"drinking_water","quantity":25,"unit":"litre"}]
}
```

### `POST /cases/:caseId/triage`

Runs or retries AI assessment. Idempotent for the same input fingerprint where appropriate.

Response:
```json
{
  "ai_status": "completed",
  "intake_assessment_id": "uuid",
  "duplicate_assessment_id": "uuid",
  "intake": {"category":"water","confidence":0.88,"missing_fields":[]},
  "duplicate_candidates": [],
  "human_review_required": true
}
```

Implemented shape (ADR-015): `{ ai_status, human_review_required, intake_assessment_id, duplicate_assessment_id, ai }`, where `ai` holds the latest intake result (fields, confidence, missing fields, uncertainties, provider) and duplicate candidates (score, reasons, differences, `public_ref`). `POST /cases` runs the same triage after the case is persisted and returns it as `triage` (`null` if it could not run). Rate limit: 10 requests per user per minute.

### `POST /cases/:caseId/submit`

Role: `field_worker` or `ngo_reviewer` in owning organization (ADR-011). Moves `submitted | needs_information → under_review` after the volunteer has checked the AI draft. No body.

### `POST /cases/:caseId/review`

Role: `ngo_reviewer` in owning organization. Case must be `under_review`.

Request:
```json
{
  "decision": "approve|needs_information|flag|reject",
  "reason_code": "complete_request|missing_details|possible_duplicate|out_of_scope|other",
  "review_note": "Synthetic demo note",
  "supplier_organization_id": "uuid",
  "supplier_wallet_pubkey": "base58-public-key",
  "target_amount_base_units": "25000000",
  "expires_at": "2026-11-08T16:00:00Z"
}
```

Only `approve` requires supplier organization, supplier wallet, amount and expiry. The supplier wallet must be a registered `supplier` membership wallet of that organization. `review_note` is private (stored as `case_events.internal_note`). The app must display these choices clearly before the reviewer signs the corresponding create-case transaction. Approval in the DB is not chain creation.

## 4. Delivery

### `POST /cases/:caseId/delivery`

Role: assigned supplier. P0 may accept structured evidence text plus a hash of the synthetic document. For file upload, use a separate private-storage flow.

Request:
```json
{
  "invoice_reference": "DEMO-INV-1042",
  "invoice_total_base_units": "25000000",
  "line_items": [{"name":"drinking_water","quantity":25,"unit":"litre"}],
  "evidence_hash": "64-hex-character-sha256"
}
```

Response: `review_status: submitted`, `ai_review_status: pending|skipped`.

### `POST /cases/:caseId/delivery/review`

Role: NGO reviewer in owning organization.

Request:
```json
{
  "decision": "approve|needs_correction|reject",
  "review_note": "Reviewed synthetic invoice and delivery note."
}
```

This creates an application audit event and prepares the human-authorized release flow. It does not by itself release tokens. The reviewer must sign the on-chain release instruction from their connected wallet.

Transitions (ADR-011): `approve` → `delivery_verified`; `needs_correction` and `reject` → back to `funded` so the supplier can resubmit.

## 5. Chain endpoints

### `POST /cases/:caseId/escrow/prepare-create`

Role: authorized NGO reviewer. Returns an unsigned transaction/instruction payload and expected account addresses. It must not sign or submit on behalf of the user.

### `POST /cases/:caseId/escrow/verify-create`

Request: `{ "signature": "base58-transaction-signature" }`

Server verifies confirmed transaction, correct program, case hash, authority, supplier, mint, amount and PDA state. Only then records `chain_status: created`.

### `POST /cases/:caseId/escrow/prepare-fund`

Role: donor. Returns expected mint, amount, vault and an unsigned funding instruction. Check the case is approved, on Devnet and not already funded.

### `POST /cases/:caseId/escrow/verify-fund`

Request: `{ "signature": "..." }`. Server verifies confirmed transaction and escrow account shows `Funded` with exact expected amount and donor.

### `POST /cases/:caseId/escrow/prepare-release`

Role: NGO reviewer. Requires a submitted delivery and an approved human review. Returns unsigned instruction data and evidence hash.

### `POST /cases/:caseId/escrow/verify-release`

Request: `{ "signature": "..." }`. Server verifies the release instruction, authorized signer, supplier destination, token mint, amount, evidence hash and final `Released` state before setting application status `completed`.

### `GET /cases/:caseId/timeline`

Returns allowlisted audit events. Identify AI-generated records vs human actions vs chain confirmations.

### `GET /public/cases/:publicRef`

No auth. Returns only public-safe case summary and chain receipts; never PII, raw request text or evidence files.

### Prepare-response shape (ADR-014)

```json
{
  "transaction_base64": "unsigned legacy transaction, fee payer = signer",
  "expected": {
    "network": "devnet",
    "program_id": "base58",
    "escrow_pda": "base58",
    "vault_token_account": "base58",
    "token_mint": "base58",
    "token_label": "ReliefMesh Demo USD (Devnet; no cash value)",
    "amount_base_units": "25000000",
    "supplier_wallet": "base58",
    "signer_wallet": "base58"
  }
}
```

Verification uses commitment `confirmed` (ADR-013).

## 6. API implementation notes

- Use an explicit state-transition service; don't accept `application_status` in generic PATCH requests.
- Add idempotency support for transaction verification and state-change submissions.
- Verify signatures against Devnet RPC; use `confirmed`/`finalized` commitment consistently and document which is used.
- Persist signature first as `submitted` if needed, then reconcile to `confirmed` only after querying chain.
- Never trust a `tx_status` or `confirmed=true` sent by the browser.
- Add rate limits to AI endpoints and file uploads.
