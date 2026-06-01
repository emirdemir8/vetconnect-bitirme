"""Map owner free-text descriptions to dataset LLT symptom labels."""
from __future__ import annotations

import re
import threading

from app.ml.serious_model import load_symptom_options_from_csv
from app.utils.risk_from_text import SYNONYM_TO_CANONICAL

_vocab_lock = threading.Lock()
_vocab_cache: list[str] | None = None

_STOP = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "in",
        "on",
        "at",
        "to",
        "for",
        "of",
        "is",
        "was",
        "are",
        "my",
        "our",
        "has",
        "have",
        "had",
        "see",
        "also",
        "with",
        "from",
        "not",
        "very",
        "been",
        "being",
        "pet",
        "cat",
        "dog",
        "she",
        "he",
        "they",
        "we",
        "it",
        "this",
        "that",
    }
)

_CANONICAL_HINTS: dict[str, tuple[str, ...]] = {
    "emesis": ("vomit", "emesis", "nausea", "regurgit"),
    "diarrhoea": ("diarr", "diare"),
    "lethargy": ("letharg", "tired", "weak", "inactive"),
    "dehydration": ("dehydr",),
    "blood in faeces": ("blood", "faec", "fec", "stool", "bloody"),
    "death": ("death", "died", "dead", "mortal", "euthan"),
    "lack of efficacy": ("lack of efficacy", "ineffective", "not working"),
    "injection site reactions": ("injection", "inject"),
    "pruritus": ("itch", "prurit", "scratch"),
    "anorexia": ("anorex", "appetite", "not eating", "won't eat"),
    "pyrexia": ("fever", "pyrex", "temperature"),
    "dyspnoea": ("breath", "dyspn", "panting", "respir"),
    "ataxia": ("ataxia", "wobbly", "coordination"),
    "seizure": ("seizure", "convuls", "fit"),
}


def get_symptom_vocabulary(*, limit: int = 2000) -> list[str]:
    global _vocab_cache
    if _vocab_cache is not None:
        return _vocab_cache
    with _vocab_lock:
        if _vocab_cache is None:
            _vocab_cache = load_symptom_options_from_csv(limit=limit)
        return _vocab_cache


def _normalize(text: str) -> str:
    t = text.lower().strip()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _meaningful_tokens(text: str) -> set[str]:
    return {t for t in _normalize(text).split() if len(t) >= 3 and t not in _STOP}


def _score_overlap(norm_text: str, norm_llt: str) -> int:
    if not norm_llt or not norm_text:
        return 0
    if norm_llt in norm_text or norm_text in norm_llt:
        return 100
    llt_t = _meaningful_tokens(norm_llt)
    text_t = _meaningful_tokens(norm_text)
    if not llt_t or not text_t:
        return 0
    overlap = llt_t & text_t
    if not overlap:
        return 0
    if len(overlap) >= 2:
        return 70 + min(20, len(overlap) * 5)
    token = next(iter(overlap))
    if len(token) >= 6:
        return 55
    return 0


def _phrase_in_text(phrase: str, norm_text: str) -> bool:
    if len(phrase) < 3:
        return False
    if " " in phrase:
        return phrase in norm_text
    return bool(re.search(r"\b" + re.escape(phrase) + r"\b", norm_text))


def _synonym_hits(norm_text: str, vocabulary: list[str]) -> list[tuple[int, str]]:
    hits: list[tuple[int, str]] = []
    seen: set[str] = set()

    for phrase, canonical in SYNONYM_TO_CANONICAL.items():
        if not _phrase_in_text(phrase, norm_text):
            continue

        hints = _CANONICAL_HINTS.get(canonical, (canonical.replace(" ", ""),))
        for llt in vocabulary:
            if llt in seen:
                continue
            norm_llt = _normalize(llt)
            if any(h in norm_llt for h in hints):
                hits.append((80, llt))
                seen.add(llt)
    return hits


def infer_llts_from_text(
    text: str,
    vocabulary: list[str] | None = None,
    *,
    max_matches: int = 8,
) -> list[str]:
    """
    Match free-text owner descriptions to LLT labels from Animal Symptoms.csv.
    """
    raw = (text or "").strip()
    if not raw:
        return []

    vocab = vocabulary if vocabulary is not None else get_symptom_vocabulary()
    if not vocab:
        return []

    chunks = [c.strip() for c in re.split(r"[\n;]+", raw) if c.strip()]
    if len(chunks) == 1:
        chunks = [c.strip() for c in re.split(r"(?<=[.!?])\s+", raw) if c.strip()] or chunks

    scored: dict[str, int] = {}

    for chunk in chunks:
        norm_chunk = _normalize(chunk)
        if len(norm_chunk) < 2:
            continue

        for llt in vocab:
            norm_llt = _normalize(llt)
            score = _score_overlap(norm_chunk, norm_llt)
            if score:
                scored[llt] = max(scored.get(llt, 0), score)

        for score, llt in _synonym_hits(norm_chunk, vocab):
            scored[llt] = max(scored.get(llt, 0), score)

    ordered = sorted(
        ((llt, score) for llt, score in scored.items() if score >= 55),
        key=lambda x: (-x[1], x[0]),
    )
    return [llt for llt, _ in ordered[:max_matches]]


def merge_symptom_lists(selected: list[str], inferred: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in [*selected, *inferred]:
        s = (item or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out
