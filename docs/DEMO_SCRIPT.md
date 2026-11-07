# Judge Demo Script — ReliefMesh (3 minutes)

## Demo setup checklist

- Solana Devnet selected in wallet.
- Demo mint created and labelled `ReliefMesh Demo USD` (no cash value).
- Donor wallet has enough demo tokens; NGO authority wallet is connected to reviewer account; supplier wallet is configured.
- Synthetic cases loaded; one case reset to `approved` or ready for review.
- API, AI service and frontend are healthy.
- Explorer links and program ID are available.
- No real beneficiary or organization data is present.

## 0:00–0:25 — State the problem

"During emergencies, local responders may receive requests across forms, calls and messages. Different organizations can struggle to reconcile overlapping requests and connect donor funding to final supplier settlement. ReliefMesh gives them one reviewable case workflow."

## 0:25–0:55 — AI request intake

Submit this synthetic request:

`Five families in Demo Ward 4 need drinking water after the flood. They have no safe drinking water for today. Request 25 litres.`

Show the extracted category, items, household count, urgency suggestion, confidence and missing information. Explain that AI creates a draft and a human reviews it.

## 0:55–1:15 — Duplicate candidate

Submit or select another synthetic request with similar wording. Show a possible duplicate candidate and the reasons. Say: "This is a similarity signal, not a fraud verdict. The reviewer decides whether the records refer to the same need."

## 1:15–1:40 — Human approval and funding

As NGO reviewer, inspect and approve the case, confirm the supplier and amount, then show the escrow PDA. As donor, inspect the exact demo-token amount and sign the funding transaction. Wait for confirmed status and open the Devnet Explorer link.

## 1:40–2:25 — Delivery evidence and release

As supplier, submit a synthetic invoice/delivery note. Show AI field extraction or structured evidence and any discrepancy flag. As NGO reviewer, inspect the evidence and authorize release. Sign the release transaction with the authority wallet.

## 2:25–2:50 — Verify the result

Show the confirmed release signature, destination supplier wallet, amount, `Released` escrow state and timeline. Point out that the beneficiary's personal data is not on-chain.

## 2:50–3:00 — Close

"AI helps organize and review information; humans remain accountable for aid decisions; Solana provides programmable escrow and a verifiable settlement trail. This is a synthetic Devnet prototype, not a live aid service."

## Judge Q&A preparation

**Why blockchain?** Multiple independent parties need a shared, tamper-evident settlement record and escrow rules without trusting one app database. Solana's low-cost settlement makes small transfers practical for a prototype.

**Why AI?** Requests and supporting documents are unstructured. AI structures and compares them to reduce manual data-entry burden. It never decides eligibility or releases money.

**How do you prevent fraud?** Do not claim fraud prevention. The prototype provides traceability, permission checks, human review and discrepancy flags. Real-world fraud mitigation requires partner processes and independent validation.

**How do you protect beneficiaries?** The demo uses synthetic data. In a real deployment, identity and evidence remain off-chain behind access controls; public chain records use random opaque references and hashes only.

**Is the demo token real USDC?** No. It is a non-redeemable Devnet test token, clearly labelled as such.

**Is delivery verified by AI?** No. AI can extract fields and flag discrepancies. A designated human reviews the evidence and signs the release instruction.
