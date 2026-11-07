# Test Plan and Acceptance Checklist

## API and authorization

- [ ] Missing/invalid auth token returns 401.
- [ ] Field worker cannot review/approve a case.
- [ ] NGO reviewer cannot access another organization's private case.
- [ ] Supplier cannot submit delivery for an unassigned case.
- [ ] Donor sees only public-safe approved case information.
- [ ] Invalid status transition returns 409.
- [ ] AI outage does not lose the submitted case.
- [ ] Duplicate API retries do not create duplicate approvals/events.

## AI

- [ ] Intake output validates against Pydantic schema.
- [ ] Missing quantity stays null/unknown.
- [ ] Urgency returns reasons and uncertainty.
- [ ] Duplicate agent returns candidate reasons, not a fraud verdict.
- [ ] Same locality but different need does not automatically become duplicate.
- [ ] Provider malformed JSON triggers safe fallback.
- [ ] Evidence agent reports discrepancy but never says delivery is physically proven.

## Anchor program

- [ ] Case creation uses unique opaque hash.
- [ ] Wrong authority cannot create/release.
- [ ] Wrong mint rejected.
- [ ] Wrong token account owner rejected.
- [ ] Exact amount funding succeeds.
- [ ] Under/over funding rejected.
- [ ] Funding after expiry rejected.
- [ ] Release before funding rejected.
- [ ] Release to any supplier other than configured supplier rejected.
- [ ] Repeat release rejected.
- [ ] Evidence hash recorded.
- [ ] If refund shipped: only donor after expiry can refund once.

## End-to-end demo

- [ ] Submit synthetic request.
- [ ] See AI extraction and duplicate suggestion.
- [ ] Human reviewer approves.
- [ ] Create escrow on Devnet.
- [ ] Donor funds with Devnet demo token.
- [ ] Supplier submits delivery evidence.
- [ ] Human reviewer verifies and signs release.
- [ ] API confirms transaction and reads `Released` state.
- [ ] Public-safe audit receipt opens Devnet Explorer.
- [ ] No PII appears in program account/event data.
