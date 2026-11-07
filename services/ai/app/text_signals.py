"""Deterministic text signals shared by the mock provider and the intake policy layer."""

import re

NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6,
    "seven": 7, "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12,
}

# `critical` may only be suggested when one of these explicit life-safety phrases appears.
CRITICAL_SIGNALS = (
    "life-threatening",
    "life threatening",
    "trapped",
    "unconscious",
    "not breathing",
    "severe bleeding",
)
HIGH_SIGNALS = (
    "no safe drinking water",
    "no drinking water",
    "no food",
    "urgent",
    "immediately",
    "for today",
    "tonight",
)
LOW_SIGNALS = ("when possible", "next week", "not urgent", "no rush")
TIME_SIGNALS = ("today", "tonight", "tomorrow", "within", "by ", "this week", "next week")


def numbers_in(text: str) -> set[int]:
    """Every integer stated in the text, as digits or number words."""
    found = {int(n) for n in re.findall(r"\d+", text)}
    words = re.findall(r"[a-z]+", text.lower())
    return found | {NUMBER_WORDS[w] for w in words if w in NUMBER_WORDS}


def first_signal(text: str, signals: tuple[str, ...]) -> str | None:
    lowered = text.lower()
    return next((s for s in signals if s in lowered), None)
