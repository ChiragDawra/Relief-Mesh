# Technical Stack and Repository Plan

## 1. Recommended stack

Choose boring, well-supported tools. The differentiator is the completed workflow, not an unusual framework.

| Layer | Choice | Why |
|---|---|---|
| Web | React + Vite + TypeScript | Fast iteration and familiar component model |
| UI | Tailwind CSS + shadcn/ui (optional) + Lucide | Consistent, polished dashboard quickly |
| Routing/data | React Router + TanStack Query | Clear pages and server-state handling |
| Forms/validation | React Hook Form + Zod | Typed form validation |
| API | Node.js LTS + Express + TypeScript | Fits existing JS skills and Solana TS ecosystem |
| AI service | Python 3.11+ + FastAPI + Pydantic | Separate structured AI workflows and Python tooling |
| LLM | Provider adapter (OpenAI-compatible API or deterministic mock) | Keep model provider swappable; do not hard-code provider into business logic |
| Similarity | `pgvector` where available; otherwise a simple embedding service + Postgres candidate filter | Explainable duplicate candidates |
| Database/auth/storage | Supabase Postgres + Auth + private Storage buckets | Fast setup, relational model and access policies |
| On-chain | Rust + Anchor + Anchor TS client | Program-controlled escrow with PDA vault |
| Wallet | Solana Wallet Adapter / supported wallet connector | User signs from their own wallet |
| Tokens | Original SPL Token Program for MVP demo mint | Widely supported and simpler than unnecessary Token-2022 extensions |
| Testing | Vitest + Supertest; Anchor tests; Playwright smoke test if time allows | Cover UI/API/contract paths |
| Hosting | Vercel for web; Render/Fly.io/Railway for API/AI if needed | Simple deployment; local demo fallback required |

## 2. Version policy

Do not blindly install `latest` across the Solana toolchain. Anchor CLI, Rust crate, TypeScript Anchor client, Solana CLI and wallet libraries must be compatible.

- Use a currently supported Node.js LTS release (prefer Node 22 LTS unless the selected Solana package requires otherwise).
- Pin exact dependency versions in lockfiles after the initial compatible install.
- Select an Anchor release from the official Anchor documentation and keep CLI and Rust crate versions aligned.
- Use a consistent Solana CLI/toolchain version for every team member.
- Use the original SPL Token Program for the first prototype; do not introduce Token-2022 extensions unless required.
- Keep `@coral-xyz/anchor`, wallet adapter and `@solana/web3.js` versions mutually compatible. Check peer dependencies before installation.
- Never upgrade the Solana toolchain during the final hours unless a blocking bug requires it.

Official docs: https://www.anchor-lang.com/docs · https://solana.com/docs · https://www.solana-program.com/docs/token

## 3. Monorepo layout

```text
reliefmesh/
├── AGENTS.md
├── BUILD_PROMPT.md
├── README.md
├── package.json                 # npm workspaces + root scripts
├── package-lock.json
├── .gitignore
├── .env.example
├── apps/
│   ├── web/                     # React + Vite
│   │   └── src/
│   │       ├── app/             # router, providers, layout
│   │       ├── components/      # shared UI
│   │       ├── features/        # cases, review, donor, supplier, audit
│   │       ├── lib/             # API client, wallet, config
│   │       └── types/
│   └── api/                     # Express API
│       └── src/
│           ├── routes/
│           ├── middleware/
│           ├── services/
│           ├── repositories/
│           ├── chain/
│           └── schemas/
├── services/
│   └── ai/                      # FastAPI
│       ├── app/
│       │   ├── routers/
│       │   ├── agents/
│       │   ├── schemas/
│       │   └── providers/
│       └── tests/
├── programs/
│   └── relief_escrow/           # Anchor program
├── packages/
│   └── shared/                  # shared Zod/TS types if useful
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
├── contracts/
├── scripts/
└── infra/
```

## 4. Root workspace scripts

Implement these scripts and keep them honest:

```json
{
  "scripts": {
    "dev": "run web and api concurrently",
    "dev:web": "npm run dev --workspace apps/web",
    "dev:api": "npm run dev --workspace apps/api",
    "dev:ai": "run FastAPI separately; document exact command",
    "lint": "lint all TypeScript workspaces",
    "typecheck": "typecheck all TypeScript workspaces",
    "test": "run unit and API tests",
    "build": "build web and API"
  }
}
```

Use `concurrently` or `npm-run-all` if convenient. Do not use a placeholder script that prints success without running checks.

## 5. Key packages to evaluate

**Frontend**
- `react`, `react-dom`, `vite`, `typescript`
- `react-router-dom`, `@tanstack/react-query`
- `tailwindcss`, `lucide-react`
- `react-hook-form`, `zod`, `@hookform/resolvers`
- Solana wallet adapter packages compatible with selected Anchor client
- `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`

**API**
- `express`, `cors`, `helmet`, `pino` or `pino-http`
- `zod`, `@supabase/supabase-js`
- `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`
- `vitest`, `supertest`

**AI**
- `fastapi`, `uvicorn`, `pydantic`, `httpx`
- Provider SDK selected by environment
- Optional `sentence-transformers` or hosted embeddings adapter
- `pytest`

## 6. Design system guidance

Use a calm emergency-operations visual language, not a speculative crypto exchange aesthetic.

- Base: warm off-white / deep navy; restrained slate neutrals.
- Status: green = verified/completed, amber = needs review, red = blocked/critical, blue = informational.
- Use plain-language status labels. Never use a green checkmark to imply a physical delivery is proven by AI.
- Prioritize readable tables, case cards, a persistent status timeline and explicit confirmation summaries.
- Show Devnet + demo-token banners wherever token balances or transactions appear.
- Add clear empty, loading, retry and failure states.

## 7. Environment separation

- `development`: local database or Supabase dev project, AI mock allowed, local validator or Devnet.
- `demo`: fixed synthetic seed, AI provider configured with rate-limit fallback, Solana Devnet, demo mint.
- `production`: not included in hackathon scope; do not imply readiness.

Never place Supabase service-role key, LLM secret, deployer keypair or supplier demo private key in the frontend environment. Frontend variables must be public-only and prefixed appropriately (`VITE_`).

## 8. Pinned versions (ADR-007, recorded 7 November 2026)

| Tool | Version |
|---|---|
| Node.js / npm | 24.x LTS / 11.x |
| TypeScript | 5.9.3 (`typescript-eslint` 8.x requires `< 6.1`) |
| Python / uv | 3.12 / 0.11 |
| Rust (rustup stable) | 1.99.1 |
| Solana CLI (Agave) | 3.1.10, platform-tools v1.52 |
| Anchor CLI / crate | 1.1.2 |
| `@solana/web3.js` | 1.x line (required by wallet adapter, `@solana/spl-token` and the Anchor TS client) |

npm dependencies are pinned with `--save-exact`; Python dependencies are locked in `services/ai/uv.lock`.

Toolchain PATH (rustup was installed with `--no-modify-path`):

```sh
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$HOME/.avm/bin:$PATH"
```
