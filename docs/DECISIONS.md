# Architecture Decision Record (ADR) Log

## ADR-001 — Build a bounded relief-coordination workflow, not a general donation marketplace

**Decision:** The MVP centers on one request-to-supplier-settlement case lifecycle.  
**Reason:** A complete, demonstrable workflow is more credible than many shallow modules.  
**Trade-off:** No broad donor marketplace, public fundraising campaigns or complex logistics optimization.

## ADR-002 — Use AI as an assistant, never a decision-maker

**Decision:** AI extracts, ranks candidate duplicates and flags evidence discrepancies. Humans decide eligibility, case approval and fund release.  
**Reason:** Humanitarian decisions are consequential; model outputs may be wrong or biased.  
**Trade-off:** More manual interaction, but a safer and more defensible product.

## ADR-003 — Solana holds only escrow state and public-safe proofs

**Decision:** Store opaque case hash, authority/donor/supplier wallets, mint, amount, status, timestamps and evidence hash on-chain. Personal data stays off-chain.  
**Reason:** Chain data is public and persistent.  
**Trade-off:** Public observers cannot independently identify the beneficiary; they can verify the settlement record and evidence hash.

## ADR-004 — One donor funds one exact case allocation in P0

**Decision:** A single donor funds the exact target amount for each case.  
**Reason:** Multi-donor partial accounting complicates refunds and contract state.  
**Trade-off:** Less flexible fundraising; can be extended after the hackathon.

## ADR-005 — Demo SPL token on Devnet, not real USDC

**Decision:** Use a team-created Devnet token labelled as having no cash value.  
**Reason:** Avoid confusing test tokens with a real stablecoin or accepting actual funds.  
**Trade-off:** Demonstrates technical settlement, not production monetary value.

## ADR-006 — Node API orchestrates; FastAPI handles bounded AI tasks

**Decision:** Keep product workflows and chain verification in Node; AI inference/structured output in Python.  
**Reason:** Fits the team's web stack and Python/ML experience while separating concerns.  
**Trade-off:** An additional service to deploy; mock provider/fallback reduces fragility.

## Gap-fill decisions (added during build, 7 November 2026)

The specification pack left the following points open. Each decision below is binding for the implementation; other documents reference these ADR numbers.

## ADR-007 — Toolchain pins

**Decision:** Node.js 24 LTS with npm workspaces; Python 3.12 managed by `uv`; Rust stable via rustup; Solana (Agave) CLI stable channel; Anchor 1.1.2 for CLI, Rust crate and TypeScript client. Exact installed versions are recorded in `docs/TECH_STACK.md` §8.  
**Reason:** Node 24 is the active LTS on the build machine; Anchor 1.1.2 is the version pinned by the official Solana installer at build time.

## ADR-008 — One root environment file

**Decision:** A single root `.env` (copied from root `.env.example`) is read by the API (`node --env-file-if-exists`), the AI service (`pydantic-settings`) and Vite (`envDir` = repo root, only `VITE_*` exposed). `infra/.env.example` is moved to the root.  
**Reason:** One place to configure the demo; Vite's prefix rule keeps server secrets out of the bundle.

## ADR-009 — Access-token verification

**Decision:** The web app signs in with Supabase Auth email/password demo users. The API verifies every bearer token with `supabase.auth.getUser(token)` and then loads memberships from the database. `SUPABASE_JWT_SECRET` is not used.  
**Reason:** Works with both legacy HS256 and asymmetric signing keys; one network call per request is acceptable for a prototype.

## ADR-010 — Data access path and atomic transitions

**Decision:** The browser never queries application tables; it calls the API only. The API uses a server-only service-role client **after** its own membership/role checks. Every application status change and its audit event are written by one Postgres function, `transition_case`, which updates the case only if the current status equals the expected `from` status (compare-and-set). RLS stays enabled on every table as defence in depth.  
**Reason:** supabase-js has no multi-statement transactions; a guarded function makes retries safe and prevents duplicate events.

## ADR-011 — Lifecycle gaps

**Decision:**
- New endpoint `POST /cases/:caseId/submit` (field worker or reviewer of the owning organization) moves `submitted | needs_information → under_review`. Reviewers act only on `under_review` cases.
- `approve` requires `supplier_organization_id`, `supplier_wallet_pubkey`, `target_amount_base_units` and `expires_at`; they are stored on `relief_cases` (`assigned_supplier_organization_id`, `supplier_wallet_pubkey`, `approved_amount_base_units`, `escrow_expires_at`).
- Escrow creation does **not** change application status (case stays `approved`, `chain_status = created`). Donors may fund only when `chain_status = created`.
- `verify-fund`: `approved → funded`. Delivery submission: `funded → delivery_submitted`.
- Delivery review `approve → delivery_verified`; `needs_correction` and `reject` both return the case to `funded` (the submission's `review_status` records which), so the supplier can resubmit.
- `verify-release`: `delivery_verified → completed`.
- Reviewer notes are private: stored in `case_events.internal_note`, never in `event_payload_public`.
- New read endpoint `GET /suppliers` lists supplier organizations and their registered supplier wallets for the approval form.

## ADR-012 — Escrow program details

**Decision:**
- Demo mint uses **6 decimals**.
- Mint allowlist: a `Config` PDA (`[b"config"]`) stores `allowed_mint`; it is initialized once by the program's upgrade authority via `initialize_config`. There is no update, close or withdraw instruction.
- Expiry boundaries: fund requires `now < expires_at`; release requires `now <= expires_at` (release permitted exactly at expiry); refund requires `now > expires_at`.
- Vault is the associated token account `(owner = case PDA, mint)`.
- The escrow authority is the reviewer's registered membership wallet (`memberships.wallet_pubkey`). `prepare-create` refuses if the reviewer has none.
- The supplier's associated token account is created idempotently (Associated Token Program `CreateIdempotent`) inside the release transaction, paid by the authority.

## ADR-013 — Chain verification

**Decision:** The API uses commitment `confirmed` for transaction lookup and account reads. A signature is accepted only if the transaction succeeded, invoked `relief_escrow` with the expected instruction, and the decoded `CaseEscrow` account matches every expected field. Verification is idempotent per signature; once a case has advanced, a different signature for the same step returns `409`.

## ADR-014 — Prepare-endpoint payload

**Decision:** `prepare-*` endpoints return a base64-serialized **unsigned** legacy transaction (fee payer = the signer's wallet, recent blockhash set) plus an `expected` summary (escrow PDA, vault, mint, amount, supplier, network, token label). The web app re-derives the PDA and vault locally and refuses to request a signature on mismatch.

## ADR-015 — Internal AI service contract

**Decision:** FastAPI exposes `GET /health`, `POST /v1/intake`, `POST /v1/duplicates`, `POST /v1/evidence`; `/v1/*` requires header `X-Internal-Token`. Node retrieves the duplicate candidate pool deterministically (same organization, last 30 days, excluding the case itself, max 20) and sends minimized summaries only. Duplicate scoring is deterministic in P0 (token overlap, locality, category, household count, time window) with configurable threshold `DUPLICATE_MIN_SCORE` (default 0.55). The external provider is any OpenAI-compatible chat-completions endpoint using JSON-schema output (`AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY`).

## ADR-016 — Idempotency and references

**Decision:** `POST /cases` accepts an `Idempotency-Key` header (UUID) stored in `relief_cases.client_request_id` (unique); a repeat returns the existing case with `200`. Transition endpoints are idempotent through compare-and-set (a repeated call returns `409 INVALID_TRANSITION` and writes no event). `public_ref` is `RM-DEMO-` + a database sequence starting at 1001. `case_ref_hash` is the SHA-256 of 32 random bytes, generated server-side.

## ADR-017 — Demo users and test strategy

**Decision:** `scripts/seed-demo.ts` creates demo Auth users through the Supabase admin API (fixed `@demo.reliefmesh.test` emails, password from `DEMO_USER_PASSWORD`) and their memberships, using only wallet **public** keys from env. API tests run against an in-memory repository and fake auth/AI/chain adapters injected through `createApp(deps)`; database functions and RLS are tested against local Supabase. Chain end-to-end verification uses `scripts/e2e-devnet.ts`, which drives the real API prepare/verify endpoints and signs with local Devnet keypairs that are never committed (a stand-in for the browser wallet in automated runs).

## Deferred decisions

- Production hosting and data residency.
- Real-world NGO onboarding and verification.
- Multi-sig or threshold authorization.
- Multi-donor funding and pooled grants.
- Token-2022 extensions.
- Mainnet launch and regulated payment operations.
