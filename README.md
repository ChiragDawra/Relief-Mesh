# ReliefMesh — Vibe-Coding Starter Pack

**Product:** ReliefMesh  
**Tagline:** Intelligence in every decision. Transparency in every disbursement.  
**Hackathon target:** Solana Hackathon · AI Track + Top 3 Overall  
**Prototype mode:** Synthetic emergency-relief scenario on Solana Devnet only

## What this pack contains

| File | Purpose |
|---|---|
| `docs/PRD.md` | Product requirements, users, scope, acceptance criteria and demo outcomes |
| `docs/TECH_STACK.md` | Stack choices, libraries, repo layout and local setup |
| `docs/SYSTEM_ARCHITECTURE.md` | Components, data flows, trust boundaries and Mermaid diagrams |
| `AGENTS.md` | Instructions for Cursor, Claude Code, Codex and other coding agents |
| `docs/AI_AGENTS.md` | AI-agent responsibilities, schemas, guardrails and evaluation |
| `docs/DATA_MODEL.md` | Entities, relationships, SQL outline and RLS rules |
| `docs/API_CONTRACT.md` | REST endpoints, request/response shapes and error contract |
| `contracts/ESCROW_SPEC.md` | Anchor program design, account model, instructions and security invariants |
| `docs/SECURITY_PRIVACY.md` | Threat model, privacy, wallet and human-approval requirements |
| `docs/IMPLEMENTATION_PLAN.md` | Critical path, team workstreams, milestones and test gates |
| `docs/DEMO_SCRIPT.md` | A clear 3-minute judge demonstration |
| `docs/DECISIONS.md` | Architectural decisions and deliberately deferred scope |
| `.env.example` | Environment variable names without real secrets (copy to root `.env`, ADR-008) |
| `BUILD_PROMPT.md` | Master prompt to start the coding agent with this specification |

## Product in one sentence

ReliefMesh helps local relief organizations turn fragmented emergency requests into reviewed, prioritized assistance cases, then uses Solana escrow to make a specific donor-to-supplier disbursement transparent and verifiable after authorized human delivery approval.

## Non-negotiable product rules

1. This is a **hackathon prototype**, not a live humanitarian aid service. Use synthetic people, organizations, cases, invoices and evidence only.
2. AI may extract, classify, compare and flag. **AI must never approve eligibility, reject a beneficiary, release money or claim physical delivery is proven.**
3. A human reviewer with the right organization role must approve every consequential action.
4. The backend never holds user wallet private keys and never signs transactions for users.
5. No beneficiary name, phone, address, photo, medical detail or other personal data is written on-chain.
6. Use a clearly labelled demo SPL token on Devnet. It is not real USDC, has no redemption value and must never be marketed as a real donation currency.
7. A transaction is complete only when the frontend/backend verifies its confirmed signature and the expected on-chain state. A UI toast is not proof.

## Recommended build order

1. Read `AGENTS.md`, `docs/PRD.md`, `docs/SYSTEM_ARCHITECTURE.md` and `contracts/ESCROW_SPEC.md`.
2. Scaffold the monorepo and make the health checks pass.
3. Implement Supabase schema, role checks and seeded synthetic data.
4. Implement the request intake + AI triage path (with deterministic fallback).
5. Implement Anchor escrow and tests independently.
6. Connect wallet funding and human-approved release.
7. Build dashboards and a complete demo flow.
8. Run the acceptance checklist in `docs/PRD.md` and rehearse `docs/DEMO_SCRIPT.md`.

## Scope discipline

The winning demonstration is one complete case lifecycle, not many unfinished screens:

`Request → AI triage / possible duplicate → human approval → donor funds escrow → delivery evidence submitted → human verifies → supplier receives tokens → public transaction receipt`

## Source references

- Solana PDA accounts: https://solana.com/docs/core/pda/pda-accounts
- Solana token concepts: https://solana.com/docs/tokens
- Solana token accounts: https://solana.com/docs/tokens/basics/create-token-account
- Anchor PDA constraints: https://www.anchor-lang.com/docs/basics/pda
- Anchor token transfers: https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth

These references explain design patterns; always check version compatibility before installing dependencies.
