# Coding-Agent Task Backlog

Use these as small, sequential tasks. Ask the coding agent to complete one task at a time and report tests before moving on.

## EPIC 0 — Repository bootstrap

- [ ] Inspect existing repository and preserve working code.
- [ ] Create npm workspaces for `apps/web`, `apps/api` and `packages/shared`.
- [ ] Add root lint/typecheck/test/build scripts that execute real commands.
- [ ] Add `.gitignore` for env files, keypairs, build outputs and local DB files.
- [ ] Add health route to API and health endpoint to AI service.

## EPIC 1 — Database and identity

- [ ] Apply `supabase/migrations/0001_init.sql` to a development project.
- [ ] Create synthetic Supabase Auth test users for each role.
- [ ] Add profile and membership seed script using auth user IDs.
- [ ] Test RLS as each role, including cross-organization access denial.
- [ ] Create demo-case seed/reset script that generates random opaque case hashes.

## EPIC 2 — Case management

- [ ] Implement shared Zod schemas for case create/update and enums.
- [ ] Implement authenticated `/me`, `POST /cases`, `GET /cases`, `GET /cases/:id`.
- [ ] Implement explicit case state-transition service and audit event writes.
- [ ] Build field-worker request form and case detail page.
- [ ] Build NGO review queue and review screen.

## EPIC 3 — AI assistance

- [ ] Implement Pydantic request/response schemas.
- [ ] Implement provider adapter with `mock` and `external` modes.
- [ ] Implement intake extraction with `null` for missing fields.
- [ ] Implement duplicate candidate retrieval/ranking with explanation.
- [ ] Store assessments as immutable snapshots.
- [ ] Add low-confidence/manual-review UI states and fixture tests.

## EPIC 4 — Solana program

- [ ] Lock Rust, Solana CLI, Anchor CLI/crate and TS-client versions.
- [ ] Implement CaseEscrow PDA and PDA-owned vault ATA.
- [ ] Implement `create_case` and `fund_case`.
- [ ] Implement `release_funds` with authority/supplier/mint/state checks.
- [ ] Add required Anchor tests including negative authorization tests.
- [ ] Deploy to Devnet and record program ID + demo mint.

## EPIC 5 — Chain integration

- [ ] Implement wallet connection and network guard in frontend.
- [ ] Implement create escrow transaction from NGO wallet.
- [ ] Implement donor funding transaction with clear token/amount confirmation.
- [ ] Implement delivery evidence submission and human approval.
- [ ] Implement authority-signed release transaction.
- [ ] Implement backend transaction verification and DB reconciliation.
- [ ] Add Devnet Explorer receipt links.

## EPIC 6 — Polish and demo

- [ ] Build donor case-funding view and supplier delivery view.
- [ ] Build public-safe transparency receipt page.
- [ ] Add DEMO/DEVNET/non-redeemable-token banners.
- [ ] Add loading, empty, error and retry states.
- [ ] Run `docs/TEST_PLAN.md` end-to-end.
- [ ] Rehearse `docs/DEMO_SCRIPT.md` from a clean reset twice.
