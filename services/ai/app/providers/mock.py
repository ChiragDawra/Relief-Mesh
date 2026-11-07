"""Deterministic rule-based provider for repeatable demos and tests (labelled 'Demo AI fixture' in the UI)."""

import re
from typing import Any

from app.providers.base import ProviderError
from app.text_signals import (
    CRITICAL_SIGNALS,
    HIGH_SIGNALS,
    LOW_SIGNALS,
    NUMBER_WORDS,
    TIME_SIGNALS,
    first_signal,
)

_NUMBER = r"(\d{1,4}|" + "|".join(NUMBER_WORDS) + r")"
_HOUSEHOLDS = re.compile(rf"\b{_NUMBER}\s+(?:families|family|households?|homes)\b", re.IGNORECASE)
_QUANTITY = re.compile(
    r"\b(\d{1,6})\s*(litres?|liters?|kg|kilograms?|packs?|boxes?|blankets?|tents?|kits?|meals?|bottles?)\b",
    re.IGNORECASE,
)
_NAMED_ITEMS = re.compile(r"\b(blankets?|tents?)\b", re.IGNORECASE)

_CATEGORY_KEYWORDS: dict[str, tuple[str, ...]] = {
    "water": ("drinking water", "water", "litre", "liter"),
    "food": ("food", "meal", "rice", "flour", "ration"),
    "shelter": ("shelter", "tent", "tarp", "blanket", "roof"),
    "medical": ("medical", "medicine", "first aid", "clinic", "bandage"),
    "transport": ("transport", "evacuat", "vehicle", "bus"),
}
_DEFAULT_ITEM = {
    "water": "drinking_water",
    "food": "food_ration",
    "shelter": "shelter_kit",
    "medical": "first_aid_kit",
    "transport": "transport_trip",
    "other": "relief_item",
}
_UNITS = {
    "litre": "litre", "litres": "litre", "liter": "litre", "liters": "litre",
    "kg": "kg", "kilogram": "kg", "kilograms": "kg",
    "pack": "pack", "packs": "pack", "box": "box", "boxes": "box",
    "kit": "kit", "kits": "kit", "meal": "meal", "meals": "meal",
    "bottle": "bottle", "bottles": "bottle",
    "blanket": "piece", "blankets": "piece", "tent": "piece", "tents": "piece",
}


def _category(text: str) -> str | None:
    lowered = text.lower()
    hits = {c: sum(lowered.count(k) for k in keys) for c, keys in _CATEGORY_KEYWORDS.items()}
    best = max(hits, key=lambda c: hits[c])
    return best if hits[best] > 0 else None


def _item_name(unit_word: str, category: str) -> str:
    singular = unit_word.lower().rstrip("s")
    return singular if singular in ("blanket", "tent") else _DEFAULT_ITEM[category]


def _extract_intake(description: str, locality_label: str) -> dict[str, Any]:
    uncertainties: list[str] = []
    category = _category(description)
    if category is None:
        uncertainties.append("No clear need category was found; set to 'other'.")
    resolved_category = category or "other"

    household_count = None
    if match := _HOUSEHOLDS.search(description):
        raw = match.group(1).lower()
        household_count = int(raw) if raw.isdigit() else NUMBER_WORDS[raw]
        if not raw.isdigit():
            uncertainties.append(f"Household count was inferred from the phrase '{match.group(0)}'.")

    items = [
        {"name": _item_name(unit, resolved_category), "quantity": int(qty), "unit": _UNITS[unit.lower()]}
        for qty, unit in _QUANTITY.findall(description)
    ]
    if not items and (named := _NAMED_ITEMS.search(description)):
        items = [{"name": _item_name(named.group(1), resolved_category), "quantity": None, "unit": None}]
    elif not items and category:
        items = [{"name": _DEFAULT_ITEM[category], "quantity": None, "unit": None}]

    urgency, reasons = None, []
    for level, signals in (("critical", CRITICAL_SIGNALS), ("high", HIGH_SIGNALS), ("low", LOW_SIGNALS)):
        if signal := first_signal(description, signals):
            urgency, reasons = level, [f'The request says "{signal}".']
            break
    if urgency is None:
        uncertainties.append("No explicit urgency signal was found.")

    missing = []
    if household_count is None:
        missing.append("household_count")
    if not items or any(i["quantity"] is None for i in items):
        missing.append("requested_items.quantity")
    if urgency is None:
        missing.append("urgency")
    if first_signal(description, TIME_SIGNALS) is None:
        missing.append("delivery_window")

    found = [category is not None, household_count is not None, any(i["quantity"] for i in items), urgency is not None]
    subject = f"{household_count} households" if household_count else "Households"
    needs = ", ".join(i["name"].replace("_", " ") for i in items) or "assistance"
    return {
        "category": resolved_category,
        "requested_items": items,
        "household_count": household_count,
        "locality_label": locality_label,
        "urgency_suggestion": urgency,
        "urgency_reasons": reasons,
        "missing_fields": missing,
        "confidence": round(0.4 + 0.12 * sum(found), 2),
        "uncertainties": uncertainties,
        "summary": f"{subject} in {locality_label} request {needs}."[:300],
    }


class MockProvider:
    name = "mock"
    model_version = "reliefmesh-demo-rules-v1"

    async def generate_structured(
        self, *, system_prompt: str, user_payload: dict[str, Any], schema: dict[str, Any]
    ) -> dict[str, Any]:
        if schema.get("title") != "IntakeResult":
            raise ProviderError("mock provider supports IntakeResult only")
        return _extract_intake(str(user_payload["description"]), str(user_payload["locality_label"]))
