# Security, Privacy and Responsible-Use Requirements

## 1. Scope and safety posture

ReliefMesh is a hackathon prototype using synthetic data and Solana Devnet. It is not approved for actual disaster response or real donations. A real deployment would require local humanitarian partners, legal review, safeguarding procedures, privacy impact assessment, data-retention rules, incident response and independent security audits.

## 2. Sensitive data rules

Never store on-chain:

- Beneficiary names, phone numbers, personal identifiers or household member details.
- Exact addresses, live GPS coordinates or shelter locations.
- Medical conditions, disability information, ethnicity, religion, political information or other sensitive attributes.
- Photos, invoice files, document URLs or unredacted request text.

Off-chain:

- Keep evidence in a private bucket.
- Use short-lived signed URLs after server-side authorization.
- Apply file size and MIME allowlists; do not trust client MIME type alone.
- Store SHA-256 file hash for integrity reference.
- Minimize data sent to external AI providers; redact names/phone numbers and avoid sensitive data entirely in the demo.
- Set retention/deletion behavior before any non-demo use.

On-chain data is public and effectively permanent. Evidence hashes are public identifiers; do not hash low-entropy personal attributes because they may be guessed. Hash only a random opaque case reference or non-sensitive evidence package.

## 3. Threat model

| Threat | Mitigation |
|---|---|
| Unauthorized case review | Verified JWT + organization membership + server role check + audit trail |
| Wrong wallet releases escrow | Program checks exact authority signer and stored supplier destination |
| Malicious token account/mint | Validate mint, token program, token-account owner and PDA vault |
| Double release / replay | State machine; only `Funded` can release; status update in program |
| LLM prompt injection in request/evidence | Treat all text as untrusted data; no tools with money/state permissions; strict schema |
| LLM hallucinated extraction | Confidence/uncertainty fields; human edits; deterministic validation |
| Duplicate false positive | Candidate-only UI; no auto-reject or auto-merge |
| Fake delivery evidence | AI cannot verify physical delivery; authorized human must inspect evidence; demo makes no real-world claim |
| Leaked secrets | Server-only environment variables; never commit `.env`, keypairs or service-role keys |
| File malware/oversized uploads | Size/type checks, private storage, optional scanning; no inline active rendering |
| RPC/client lies about success | Backend independently verifies signature and program account state |
| Public dashboard reveals identities | Allowlisted public projection; synthetic locality labels only |

## 4. Wallet safety requirements

- No seed phrase/private key input form.
- No server signing with donor or NGO wallets.
- No hidden transaction submission.
- Show a human-readable transaction confirmation summary before wallet signing.
- The wallet signature is explicit consent for the displayed transaction, not consent to unrelated future actions.
- Restrict network to Devnet for demo; block mainnet configuration in demo build.
- The backend must compare the transaction's program ID, accounts, mint, amount and state to the expected operation.

## 5. Human review and AI governance

- Every AI panel displays `AI-assisted suggestion — human review required`.
- Display why an item was flagged and what information is missing.
- Provide a correction path and record human overrides.
- Similarity is not evidence of fraud.
- Urgency scoring is not an eligibility score.
- No automated denial, rationing, ranking of human worth or release of funds.
- The human reviewer sees original evidence and AI extraction side by side.

## 6. Logging and observability

Log: request ID, route, status code, elapsed time, actor ID (internal), case UUID, model version, chain signature and error code.

Do not log: access tokens, private keys, seed phrases, raw evidence, exact personal data, signed URLs or full prompts with unredacted content.

## 7. Demo disclaimer text

Display visibly in app footer and wallet/funding screen:

`DEMO ONLY — Synthetic relief data and non-redeemable Devnet tokens. This prototype is not an emergency service and does not accept real donations.`
