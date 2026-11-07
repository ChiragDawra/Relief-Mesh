# Solana Anchor Escrow Program Specification

**Program:** `relief_escrow`  
**Cluster:** Devnet only for hackathon  
**Asset:** Original SPL Token Program demo mint with 6 decimals (or a single documented decimal choice)  
**Purpose:** Hold one exact case allocation and release it to a pre-configured supplier only after the authorized NGO authority signs.

## 1. Security model

- The case account is a PDA derived by the program from an opaque 32-byte `case_ref_hash`.
- A vault token account is an associated token account (or a PDA token account) whose authority is the case PDA.
- The donor signs the funding transaction from their wallet.
- The NGO authority signs the release transaction from its wallet.
- The supplier is fixed at case creation; it cannot be changed after funding.
- The program never sees beneficiary identity or raw evidence. It receives only the SHA-256 hash of the reviewed evidence package.
- The server does not own any user signer key.

Use Anchor PDA constraints and token CPI helpers. A PDA address is not an account until the program creates it. Token transfers should use `transfer_checked` with the mint and decimals; PDA-authorized withdrawals must sign via PDA seeds. Official reference: https://www.anchor-lang.com/docs/basics/pda and https://www.anchor-lang.com/docs/tokens/basics/transfer-tokens.

## 2. PDA and account model

### `CaseEscrow` account

Suggested fields:

```rust
pub struct CaseEscrow {
    pub case_ref_hash: [u8; 32],
    pub authority: Pubkey,
    pub supplier: Pubkey,
    pub mint: Pubkey,
    pub donor: Pubkey,
    pub target_amount: u64,
    pub funded_amount: u64,
    pub expires_at: i64,
    pub status: EscrowStatus,
    pub evidence_hash: [u8; 32],
    pub bump: u8,
}

pub enum EscrowStatus {
    Created,
    Funded,
    Released,
    Refunded,
}
```

Use Anchor's required serialization traits and calculate account space including discriminators and enum sizing. `donor` can be `Pubkey::default()` until funded. Avoid storing personal data.

### Seeds

`case_pda = PDA([b"case", case_ref_hash], program_id)`

Vault: associated token account for `(owner = case_pda, mint = configured_demo_mint)` using the Associated Token Program. This is a standard pattern; validate the token program and mint explicitly.

### `Config` account (ADR-012)

`config_pda = PDA([b"config"], program_id)` stores `allowed_mint: Pubkey` and `bump`. Created once by `initialize_config(allowed_mint)`, whose signer must equal the program's upgrade authority (checked through the `ProgramData` account). No instruction can update or close it.

### Fixed decisions (ADR-012)

- Mint decimals: 6.
- `fund_case`: `now < expires_at`. `release_funds`: `now <= expires_at`. `refund_expired`: `now > expires_at`.
- The release transaction prepends an Associated Token Program `CreateIdempotent` instruction for the supplier ATA, paid by the authority; the program then requires `supplier_token_account.owner == escrow.supplier` and `mint == escrow.mint`.

## 3. Instructions

### `create_case(case_ref_hash, supplier, mint, target_amount, expires_at)`

**Signer:** NGO `authority`  
**Preconditions:** target amount > 0; expiry is in the future; case PDA does not exist; mint is the configured/demo-allowed mint (for MVP, use a fixed configured mint or explicit allowlist).  
**Effects:** initialize CaseEscrow, create/init PDA-owned vault ATA, set status `Created`, emit `CaseCreated` event.

### `fund_case(amount)`

**Signer:** donor  
**Preconditions:** status `Created`; current time < expiry; amount exactly equals `target_amount`; amount > 0; donor source token account mint matches; donor is source token account owner; vault mint and authority match; source balance sufficient.  
**Effects:** `transfer_checked` donor tokens into vault; set donor and funded amount; set status `Funded`; emit `CaseFunded` event.

**MVP limitation:** one donor funds the exact target amount. Do not add partial/multi-donor funding until the single-donor flow is tested.

### `release_funds(evidence_hash)`

**Signer:** recorded NGO authority  
**Preconditions:** status `Funded`; current time <= expiry (choose and document whether release is permitted exactly at expiry); non-zero evidence hash; supplied supplier token account owner is exactly stored supplier; mint matches; vault authority is case PDA; vault amount equals expected target.  
**Effects:** transfer full escrow amount from PDA vault to supplier's token account using `transfer_checked` and PDA signer seeds; store evidence hash; set status `Released`; emit `FundsReleased` event.

The authority signature is the human's authorization. AI cannot invoke this instruction.

### `refund_expired()`

**Signer:** recorded donor  
**Preconditions:** status `Funded`; current time > expiry; donor token account owner is recorded donor; mint matches; vault holds expected amount.  
**Effects:** PDA transfers full amount back to donor; status `Refunded`; emit `FundsRefunded` event.

P1 if time is short, but if included it needs tests and UI. Do not implement a refund that can be triggered before expiry or sent to an arbitrary wallet.

## 4. Events

Events contain only:

- `case_ref_hash`
- authority/donor/supplier public keys
- mint
- base-unit amount
- timestamp
- status transition
- evidence hash for release

Never emit case description, beneficiary identity, location coordinates, invoice text or evidence URL.

## 5. Required invariants

1. One escrow PDA per opaque case hash.
2. Mint cannot change after creation.
3. Supplier cannot change after creation/funding.
4. Only the recorded authority can release.
5. Only the recorded donor can refund after expiry.
6. Tokens cannot be released before state is `Funded`.
7. Release can happen only once.
8. Refund can happen only once and only after expiry.
9. Amounts use integer base units and cannot exceed/underflow `u64`.
10. Vault token account must be controlled by the correct case PDA and use the correct mint.
11. No arbitrary destination account can receive escrow tokens.
12. No admin backdoor withdraw instruction exists.

## 6. Required tests

- Creates case with valid authority and args.
- Rejects zero target amount.
- Rejects expired/past expiry at creation.
- Rejects duplicate case hash.
- Rejects wrong mint.
- Funds exact amount successfully.
- Rejects underfunding/overfunding.
- Rejects wrong source token owner.
- Rejects funding after expiry.
- Rejects fund twice.
- Rejects release by non-authority.
- Rejects release before funded.
- Rejects supplier destination mismatch.
- Rejects wrong vault mint/authority.
- Releases once and records evidence hash.
- Rejects second release.
- If refund included: rejects before expiry, wrong donor and second refund; allows correct expired refund.

## 7. Client integration

- Derive PDA and vault addresses client-side from the IDL/program ID.
- Display network `Solana Devnet` and token `ReliefMesh Demo USD (Devnet; no cash value)` before wallet confirmation.
- Show recipient/supplier, amount, case public reference and destination account before signing.
- Use wallet adapter/connected wallet signer.
- After wallet returns a signature, show `Pending confirmation` until RPC confirms and account state is read.
- API verifies the signature independently before mirroring chain status.

## 8. Demo token setup

- Create one demo mint on Devnet with a test keypair kept locally by the team.
- Mint demo units only to team-owned demo wallets for judging.
- Document mint address and decimals in deployment notes.
- Label it clearly as non-redeemable demo-only tokens.
- Never imply the token is backed by actual USD or represents a real donation.

## 9. Implementation guidance

Use the official Anchor docs and a maintained example for PDA-owned token accounts. Keep Anchor CLI, Rust crate and TypeScript client versions aligned. Prefer `transfer_checked` and standard token account/ATA validation. Avoid adding upgrade/admin mechanisms beyond what Anchor deployment requires for a hackathon prototype.
