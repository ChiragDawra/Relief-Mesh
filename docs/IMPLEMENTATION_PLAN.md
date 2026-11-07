# Weekend Implementation Plan

**Objective:** one polished, verified case lifecycle. Use parallel workstreams only where interfaces are agreed.

## 1. Workstream division

### If team has 3–4 members

| Owner | Primary responsibility | Deliverable |
|---|---|---|
| Full-stack lead | API, DB, auth, integration and architecture | Case lifecycle APIs + end-to-end integration |
| Solana engineer | Anchor program, tests, Devnet deploy, wallet flow | Working escrow create/fund/release |
| AI engineer | FastAPI, structured extraction, duplicate suggestions | AI assessment endpoints + fixtures |
| UI engineer | React dashboards, forms, timeline, responsive polish | Role workflows and demo screens |

For a 2-person team, combine API + UI for one person and Anchor + AI for the other; keep the demo flow smaller. For solo, use deterministic AI mocks first and do not start P1 work until a real Devnet fund/release works.

## 2. Milestones and gates

### M0 — Product and repo bootstrap (first 1–2 hours)

- Confirm one exact happy-path case lifecycle.
- Create repo/workspaces and scripts.
- Add `.env.example` and `AGENTS.md`.
- Create one seeded demo case and role accounts.
- Gate: web, API and AI health endpoints run locally.

### M1 — Data, auth and core workflow (next 3–5 hours)

- Supabase migrations and RLS.
- Authenticated role context and organization-scoped APIs.
- Create/list/detail/update case.
- Event timeline and state-transition service.
- Gate: create and review a case without AI or chain.

### M2 — AI assistance (next 2–3 hours)

- Intake extraction with schema validation.
- Duplicate candidates using fixtures/deterministic scoring first; add embeddings if ready.
- Store assessment and display uncertainty.
- Gate: one request yields a structured editable suggestion; AI outage does not block case entry.

### M3 — Escrow contract (parallel; 4–7 hours)

- Build Anchor program and state/account constraints.
- Run tests locally.
- Create demo mint and test wallets on Devnet.
- Deploy program to Devnet.
- Gate: fund and release work on Devnet from authorized wallets; wrong signer is rejected.

### M4 — Integration (3–5 hours)

- Create case escrow after human approval.
- Donor wallet funding and verification.
- Supplier evidence submission.
- NGO authority release and backend verification.
- Gate: full lifecycle is performed without manually editing DB rows.

### M5 — Polish and rehearsal (final 3–4 hours)

- Improve dashboard hierarchy and loading/error states.
- Add public-safe transaction receipt page.
- Add clear Devnet/demo-token banners.
- Seed/reset script.
- Record 3-minute demo and create a 1-page architecture image/diagram if desired.
- Gate: complete demo works twice consecutively from reset.

## 3. Critical path

`Anchor program + wallet funding/release` and `case/auth workflow` are the two highest-risk tracks. Start both immediately. Do not leave smart-contract work until the UI is finished.

## 4. Cut list if time slips

Cut in this order:

1. Public map and geospatial visualization.
2. OCR upload and automatic invoice extraction (use structured synthetic invoice form).
3. Pooled funding or multiple donors.
4. Refund UI (keep contract test if already implemented).
5. Advanced analytics and notification system.
6. External LLM (use deterministic fixtures for rehearsed demo, but show AI architecture and real AI path if available).

Never cut:

- One real Devnet escrow funding transaction.
- One real Devnet release transaction.
- Program authorization checks.
- Backend signature verification.
- Human approval gate.
- Privacy restrictions.

## 5. Test gates

- `lint`, `typecheck`, `test`, `build` pass.
- API tests cover role authorization and invalid state changes.
- AI tests cover schema invalidity, missing data and false-positive duplicate caution.
- Anchor tests cover unauthorized release, wrong mint, wrong supplier and repeat release.
- Browser smoke test covers case intake to completed receipt.
- Devnet demo run verifies actual transaction signatures.

## 6. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Solana toolchain mismatch | Medium | High | Lock compatible versions early; start contract immediately |
| Wallet/RPC failures at demo | Medium | High | Pre-fund demo wallets; rehearse; keep screenshots/video backup but clearly label backup |
| AI API quota/network issue | Medium | Medium | Mock provider with fixed fixtures and visible `Demo AI fixture` label |
| RLS blocks intended demo | Medium | High | Seed test users and test as each role, not only service key |
| Contract deployment delay | Medium | High | Use minimal escrow program; local tests before UI integration |
| Over-scoped UI | High | Medium | Build only three main role workflows and the audit view |
| Privacy leak in public explorer | Low | High | Only opaque case hash and evidence hash on-chain; inspect account/event fields |

## 7. Execution plan (single-agent build)

Each phase follows **build → verify → test → commit**. A phase is closed only when its gate commands have actually been run and passed. Gap-fill decisions are ADR-007…ADR-017 in `DECISIONS.md`.

| Phase | Scope | Gate (commands actually run) |
|---|---|---|
| 0 — Bootstrap | git repo; npm workspaces `apps/web`, `apps/api`, `packages/shared`; strict TS, ESLint, Vitest; root scripts; `.gitignore`; root `.env.example`; API `GET /api/v1/health`; FastAPI `GET /health`; web shell with DEMO/DEVNET banner | `npm run lint typecheck test build`; `uv run pytest`; health endpoints respond |
| 1 — Data & identity | `supabase/config.toml`; migration `0002_workflow.sql` (columns, sequence, trigger, `transition_case`); `scripts/seed-demo.ts` (orgs, auth users, memberships); SQL/RLS tests on local Supabase | `supabase db reset` applies cleanly; RLS test: cross-organization read denied, compare-and-set rejects stale transition |
| 2 — Case lifecycle (no AI, no chain) | shared Zod schemas + state machine; API auth middleware, repository (Supabase + in-memory for tests), services, routes `/me`, `/suppliers`, `/cases`, `/submit`, `/review`, `/timeline`, `/public/cases/:ref`; web login, case list, intake form, case detail + timeline, review queue/actions | API tests for 401/403/404/409, cross-org denial, idempotent create; web build; manual create → submit → approve |
| 3 — AI assistance | FastAPI intake/duplicate/evidence agents, `mock` + OpenAI-compatible provider, schema validation + fallback, 10-scenario fixture eval; API `POST /cases/:id/triage` with outage fallback; web AI panel with required disclaimers | `uv run pytest`; API test: AI down keeps case and sets `ai_status = unavailable` |
| 4 — Escrow + integration | Anchor program (`initialize_config`, `create_case`, `fund_case`, `release_funds`, `refund_expired`) + all spec tests; Devnet deploy + demo mint; API `SolanaEscrowService` prepare/verify; delivery submit/review; web wallet connect, fund and release screens | `anchor test`; `scripts/e2e-devnet.ts` performs real create/fund/release on Devnet through the API |
| 5 — Proof & polish | public receipt page with Explorer links; banners/disclaimers; loading/empty/error states; `scripts/verify-chain.ts`; demo reset; README run guide | full gate suite; e2e run twice from reset; PII scan of on-chain account data |
