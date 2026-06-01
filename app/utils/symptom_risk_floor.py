"""
Raise risk level when selected LLT symptoms imply clinical severity.

ML probability alone can under-rank cases where catastrophic terms (e.g. Death)
appear alongside many milder labels. Floor = minimum level (1 = highest urgency).
"""
from __future__ import annotations

# (risk level 1–5, substrings matched against lowercased LLT label)
_FLOOR_RULES: list[tuple[int, tuple[str, ...]]] = [
    (
        1,
        (
            "death",
            "death by euthanasia",
            "mortality",
            "euthanasia",
            "digestive tract haemorrhage",
            "digestive tract hemorrhage",
            "haemorrhage",
            "hemorrhage",
            "anaphylaxis",
            "anaphylactic",
            "cardiac arrest",
            "respiratory arrest",
            "shock",
            "collapse",
            "coma",
            "unresponsive",
        ),
    ),
    (
        2,
        (
            "pneumonitis",
            "respiratory distress",
            "dyspnoea",
            "dyspnea",
            "difficulty breathing",
            "blood in faeces",
            "blood in feces",
            "blood in stool",
            "bloody",
            "dehydration",
            "convulsion",
            "seizure",
            "paralysis",
            "paralys",
            "paralyz",
            "cyanosis",
            "hypotension",
            "myopathy",
            "muscle wasting",
        ),
    ),
    (
        3,
        (
            "vomiting",
            "emesis",
            "haematemesis",
            "hematemesis",
            "diarrhoea",
            "diarrhea",
            "pyrexia",
            "hyperthermia",
            "inappetence",
            "anorexia",
            "not eating",
            "lethargy",
            "ataxia",
            "pruritus",
        ),
    ),
]

_LEVEL_LABELS: dict[int, str] = {
    1: "Level 1: Critical symptoms reported - urgent veterinary attention.",
    2: "Level 2: Serious symptoms reported - contact your veterinarian promptly.",
    3: "Level 3: Notable symptoms - monitoring and timely vet visit advised.",
    4: "Level 4: Low–moderate probability.",
    5: "Level 5: Low seriousness probability.",
}


def _symptom_level(symptom: str) -> int:
    s = symptom.strip().lower()
    if not s:
        return 5
    for level, patterns in _FLOOR_RULES:
        if any(p in s for p in patterns):
            return level
    return 5


def compute_symptom_risk_floor(symptoms: list[str]) -> tuple[int | None, list[str]]:
    """
    Derive the strictest (lowest number) risk level implied by symptom labels.
    Returns (floor_level, symptom labels that triggered a rule).
    """
    if not symptoms:
        return None, []

    floor = 5
    triggers: list[str] = []
    for sym in symptoms:
        lvl = _symptom_level(sym)
        if lvl < floor:
            floor = lvl
        if lvl <= 3:
            triggers.append(sym)

    if floor == 5:
        return None, []
    return floor, triggers


def apply_symptom_risk_floor(result: dict, symptoms: list[str]) -> dict:
    """Merge ML output with symptom-based floor; mutates and returns result."""
    floor, triggers = compute_symptom_risk_floor(symptoms)
    if floor is None:
        return result

    out = dict(result)
    ml_level = int(out.get("risk_level") or 5)
    effective = min(ml_level, floor)
    out["risk_level"] = effective
    out["risk_label"] = _LEVEL_LABELS.get(effective, _LEVEL_LABELS[5])

    if effective <= 2:
        out["serious"] = True
    elif effective == 3 and not out.get("serious"):
        proba = out.get("ml_serious_probability")
        if proba is not None and float(proba) >= 0.35:
            out["serious"] = True

    if effective < ml_level and triggers:
        critical = [t for t in triggers if _symptom_level(t) <= 2]
        shown = critical[:4] if critical else triggers[:4]
        note = (
            "Risk level adjusted upward because reported symptoms include serious clinical "
            f"terms (e.g. {', '.join(shown)})."
        )
        reasons = list(out.get("reasons") or [])
        reasons.append(note)
        out["reasons"] = reasons
        out["symptom_risk_floor"] = floor
        out["symptom_floor_triggers"] = triggers

    return out
