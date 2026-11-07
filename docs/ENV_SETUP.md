# Environment Setup Checklist

1. Create a Supabase development project.
2. Apply migrations and seed only synthetic records.
3. Configure Supabase Auth test users for field worker, NGO reviewer, donor and supplier.
4. Set public frontend variables in the web app environment; set service-role key only in the Node API environment.
5. Install a compatible Solana CLI + Anchor toolchain and pin versions in project docs.
6. Set Devnet RPC, deploy the Anchor program and record the program ID.
7. Create a Devnet demo SPL mint; record mint address and decimals. Mint demo units to team-controlled wallets.
8. Configure the AI provider. Start with `AI_PROVIDER=mock` so the full workflow is repeatable; add external provider after schema tests pass.
9. Verify that frontend build does not contain any server-only secret.
10. Rehearse the full flow twice from a clean seed/reset.

Never paste a private key, seed phrase, LLM API key or Supabase service-role key into the coding agent chat, source code, issue tracker or frontend environment.
