"""Evidence Review Agent, P0 structured-form version (AI_AGENTS.md §5).

Reports differences between the submitted invoice and the approved scope. It never states that
delivery happened, that goods reached anyone or that a document is authentic.
"""

from app.schemas import EvidenceFinding, EvidenceRequest, EvidenceResponse, RequestedItem


def format_base_units(value: int, decimals: int) -> str:
    """Integer-only formatting, same rules as packages/shared formatBaseUnits."""
    digits = str(value).rjust(decimals + 1, "0")
    whole, fraction = digits[: len(digits) - decimals], digits[len(digits) - decimals :].rstrip("0")
    return f"{int(whole):,}" + (f".{fraction}" if fraction else "")


def _key(item: RequestedItem) -> str:
    return item.name.strip().lower().replace(" ", "_")


def _quantity(item: RequestedItem) -> str:
    return f"{item.quantity} {item.unit or ''}".strip()


def review_evidence(request: EvidenceRequest) -> EvidenceResponse:
    findings: list[EvidenceFinding] = []
    approved = int(request.approved_amount_base_units)

    def fmt(value: int) -> str:
        return format_base_units(value, request.token_decimals)

    if request.invoice_total_base_units is None:
        findings.append(
            EvidenceFinding(
                kind="total_missing",
                message="The submission does not state an invoice total. Please inspect the original document.",
            )
        )
    else:
        total = int(request.invoice_total_base_units)
        if total == approved:
            findings.append(
                EvidenceFinding(
                    kind="total_matches",
                    message=f"The submitted invoice total equals the approved {fmt(approved)} demo tokens. "
                    "This does not by itself show that goods were delivered.",
                )
            )
        else:
            direction = "above" if total > approved else "below"
            findings.append(
                EvidenceFinding(
                    kind="total_mismatch",
                    message=f"The submitted invoice total is {fmt(total)} demo tokens; this is "
                    f"{fmt(abs(total - approved))} {direction} the approved {fmt(approved)} demo tokens. "
                    "Please inspect the original document.",
                )
            )

    requested = {_key(i): i for i in request.requested_items}
    invoiced = {_key(i): i for i in request.line_items}
    for key, item in requested.items():
        line = invoiced.get(key)
        if line is None:
            findings.append(
                EvidenceFinding(kind="item_missing", message=f"Requested item '{item.name}' does not appear on the invoice.")
            )
        elif item.quantity is not None and line.quantity is not None and item.quantity != line.quantity:
            findings.append(
                EvidenceFinding(
                    kind="item_quantity_differs",
                    message=f"The invoice lists {_quantity(line)} of '{item.name}'; {_quantity(item)} were requested.",
                )
            )
    for key in invoiced.keys() - requested.keys():
        findings.append(
            EvidenceFinding(
                kind="item_not_requested",
                message=f"Invoice item '{invoiced[key].name}' was not part of the approved request.",
            )
        )

    return EvidenceResponse(
        findings=findings, discrepancy_detected=any(f.kind != "total_matches" for f in findings)
    )
