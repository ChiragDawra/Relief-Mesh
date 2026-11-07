# AGENTS.md — ReliefMesh Coding-Agent Contract

This file is the highest-priority project instruction for AI coding assistants. Read it before changing code. The PRD and architecture docs define expected behavior; this file defines how to work safely and consistently.

## 1. Mission

Build the ReliefMesh hackathon MVP: an AI-assisted emergency-aid coordination workflow with a real Solana Devnet SPL-token escrow lifecycle and human-controlled approvals.

## 2. Source of truth

Before implementation, read:

1. `docs/PRD.md`
2. `docs/SYSTEM_ARCHITECTURE.md`
3. `docs/DATA_MODEL.md`
4. `docs/API_CONTRACT.md`
5. `docs/AI_AGENTS.md`
6. `contracts/ESCROW_SPEC.md`
7. `docs/SECURITY_PRIVACY.md`

If instructions conflict, prioritize: security/privacy invariants → escrow specification → API contract → PRD → implementation convenience. Record unresolved contradictions in `docs/DECISIONS.md`; do not silently invent product behavior.

## 3. Hard constraints

- Use only synthetic demo data. Do not ingest real disaster-victim data.
- Never put PII or evidence files on-chain. Only opaque case hashes, wallet addresses, token amounts, timestamps, state and evidence hashes may be on-chain.
- Never let an LLM make final eligibility decisions, approve a case, approve delivery, sign a transaction, or release funds.
- No server-side wallet custody. Never request, store, log or transmit seed phrases or private keys.
- Wallet signatures must be initiated by the user in their connected wallet.
- Never claim that a photo, invoice, GPS coordinate or AI result proves physical delivery. It is supporting evidence reviewed by an authorized human.
- AI duplicate matches are suggestions only. Do not auto-merge or auto-reject cases.
- Do not call the demo token USDC. Label it `ReliefMesh Demo USD (Devnet; no cash value)`.
- Do not use mainnet or real funds. Only Devnet for the hackathon demo.
- Validate all amounts in integer base units. Never use JavaScript floating point for token accounting.
- Enforce roles and authorization on the server and in the on-chain program where applicable. Hiding a button is not authorization.

## 4. Engineering practices

- TypeScript strict mode for frontend and backend.
- Validate all untrusted input at API boundaries with Zod (or an equivalent schema library).
- Keep business logic out of React components and route handlers; use service modules.
- Keep AI provider calls behind an adapter so the provider can be replaced and a deterministic mock can be used during demos.
- Keep chain operations behind a `SolanaEscrowService`; do not scatter Anchor calls throughout the app.
- Keep database operations behind repository/service functions; do not build SQL strings from user input.
- Use structured logs, but never log raw evidence, personal data, access tokens or secrets.
- Add tests for all state transitions and authorization checks.
- Use idempotency keys for create/fund/release submission flows and handle transaction retries safely.
- Prefer small, reviewable commits and vertical slices. Do not generate the entire app in one giant change.

## 5. Required repo shape

```text
apps/
  web/                 # React + Vite frontend
  api/                 # Node + Express API
services/
  ai/                  # FastAPI AI service
programs/
  relief_escrow/       # Anchor program
packages/
  shared/              # Shared TypeScript schemas/types
  config/              # Shared lint/tsconfig if useful
supabase/
  migrations/
  seed.sql
  config.toml
scripts/
  dev-check.sh
  seed-demo.ts
  verify-chain.ts
```

Adjust only if the repository already has a sensible structure; document deviations.

## 6. Definition of done for a feature

A feature is not done until:

1. It matches the relevant acceptance criteria.
2. Input validation and server-side authorization exist.
3. Loading, empty, error and success states exist in the UI.
4. A test covers its important happy path and at least one failure path.
5. No secrets or personal data are exposed in logs or client bundles.
6. The README/docs are updated when behavior or setup changes.

## 7. Work sequence

Implement in this order:

1. Repo bootstrap, lint/typecheck/test commands and `.env.example`.
2. Database migrations, seed data, auth and role authorization.
3. Request intake and case list/detail without AI.
4. AI triage endpoint with structured output and mock fallback.
5. Anchor program and local/Devnet tests.
6. Fund workflow from connected wallet.
7. Delivery submission, human verification and release workflow.
8. Transaction confirmation and audit timeline.
9. Dashboard polish and demo rehearsal.

Do not build optional features ahead of the P0 lifecycle.

## 8. Commands and quality gates

Keep root scripts for at least:

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Also document the separate commands for the Anchor program and FastAPI service. Never claim a command passed unless it was actually run.

## 9. Output expected from the coding agent

At the end of each implementation phase, report:

- Files created/changed
- What works end-to-end
- Commands/tests actually run and results
- Environment variables still required
- Known limitations and next smallest task

Do not silently skip failing tests. Do not fake blockchain success in production code; a mock chain adapter is allowed only when clearly labelled and selected through an explicit demo/test configuration.
