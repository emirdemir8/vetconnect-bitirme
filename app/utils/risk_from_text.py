"""
Serbest metin (yorum) girdisinden semptom ve risk seviyesi çıkarımı.
Örn: "We have frequent vomitting complaints in my cat" -> emesis (level_3).
Kelime bazlı exact match yerine eşanlamlılar ve ifade eşlemesi kullanır.
"""
from __future__ import annotations

import re
from typing import Any

# Serbest metindeki ifadeleri risk terimlerine (canonical) eşleyen harita.
# Key: normalize edilmiş ifade veya kelime, Value: RISK_LEVEL_TERMS içindeki canonical terim.
SYNONYM_TO_CANONICAL: dict[str, str] = {
    # level_3 - emesis
    "vomit": "emesis",
    "vomiting": "emesis",
    "vomitting": "emesis",
    "vomited": "emesis",
    "vomits": "emesis",
    "throwing up": "emesis",
    "throw up": "emesis",
    "nausea": "emesis",
    "emesis": "emesis",
    "kusma": "emesis",
    "kusmak": "emesis",
    "kustu": "emesis",
    # level_3 - diarrhoea
    "diarrhoea": "diarrhoea",
    "diarrhea": "diarrhoea",
    "loose stool": "diarrhoea",
    "loose stools": "diarrhoea",
    "runny stool": "diarrhoea",
    "ishal": "diarrhoea",
    "diare": "diarrhoea",
    # level_3 - mucous stool
    "mucous stool": "mucous stool",
    "mucus in stool": "mucous stool",
    "mucus stool": "mucous stool",
    # level_3 - hyperhidrosis
    "hyperhidrosis": "hyperhidrosis",
    "sweating": "hyperhidrosis",
    "excessive sweating": "hyperhidrosis",
    # level_5 - lethargy
    "lethargy": "lethargy",
    "lethargic": "lethargy",
    "tired": "lethargy",
    "weakness": "lethargy",
    "weak": "lethargy",
    "inactive": "lethargy",
    "lazy": "lethargy",
    "halsiz": "lethargy",
    "halsizlik": "lethargy",
    "yorgun": "lethargy",
    # level_5 - injection site
    "injection site reactions": "injection site reactions",
    "injection site": "injection site reactions",
    "injection site reaction": "injection site reactions",
    "swelling at injection": "injection site reactions",
    "reaction at injection": "injection site reactions",
    # level_2 - dehydration
    "dehydration": "dehydration",
    "dehydrated": "dehydration",
    # level_2 - blood in faeces
    "blood in faeces": "blood in faeces",
    "blood in feces": "blood in faeces",
    "blood in stool": "blood in faeces",
    "bloody stool": "blood in faeces",
    "bloody faeces": "blood in faeces",
    "bloody feces": "blood in faeces",
    # level_2 - myopathy / muscle wasting
    "myopathy": "myopathy",
    "muscle wasting": "muscle wasting",
    "muscle loss": "muscle wasting",
    "muscle weakness": "myopathy",
    "muscle disease": "myopathy",
    # level_1 - death
    "death": "death",
    "death by euthanasia": "death by euthanasia",
    "died": "death",
    "dead": "death",
    "mortality": "death",
    # level_1 - digestive tract haemorrhage
    "digestive tract haemorrhage": "digestive tract haemorrhage",
    "gut bleeding": "digestive tract haemorrhage",
    "stomach bleeding": "digestive tract haemorrhage",
    "intestinal bleeding": "digestive tract haemorrhage",
    "haemorrhage": "digestive tract haemorrhage",
    "hemorrhage": "digestive tract haemorrhage",
    "bleeding gut": "digestive tract haemorrhage",
    # level_1 - pneumonitis / hyponatremia
    "pneumonitis": "pneumonitis",
    "lung inflammation": "pneumonitis",
    "hyponatremia": "hyponatremia",
    "low sodium": "hyponatremia",
    # level_4
    "lack of efficacy": "lack of efficacy",
    "not working": "lack of efficacy",
    "ineffective": "lack of efficacy",
    "no effect": "lack of efficacy",
    "drug not working": "lack of efficacy",
    "other abnormal test result": "other abnormal test result",
    "infectious disease nos": "infectious disease nos",
}

# Çok kelimeli ifadeleri önce kontrol etmek için (uzun -> kısa sıra).
PHRASE_ORDER = [
    "death by euthanasia",
    "digestive tract haemorrhage",
    "blood in faeces",
    "blood in feces",
    "blood in stool",
    "bloody stool",
    "muscle wasting",
    "injection site reactions",
    "injection site reaction",
    "lack of efficacy",
    "other abnormal test result",
    "infectious disease nos",
    "mucous stool",
    "mucus in stool",
    "throwing up",
    "throw up",
    "loose stool",
    "loose stools",
    "lung inflammation",
    "low sodium",
    "excessive sweating",
    "swelling at injection",
    "reaction at injection",
    "intestinal bleeding",
    "stomach bleeding",
    "gut bleeding",
    "muscle weakness",
    "muscle disease",
    "muscle loss",
    "dry mouth",
    "not drinking",
]


def _normalize(s: str) -> str:
    """Küçük harf, fazla boşluk temizle, noktalama bırak (kelime içi için)."""
    s = s.lower().strip()
    s = re.sub(r"\s+", " ", s)
    return s


def _tokenize(text: str) -> list[str]:
    """Metni kelimelere böl (noktalama ayır)."""
    normalized = _normalize(text)
    # Kelimeler: harf ve rakam blokları
    tokens = re.findall(r"[a-z0-9]+", normalized)
    return tokens


def _extract_phrases(text: str) -> list[str]:
    """Metinde geçen çok kelimeli ifadeleri bul (PHRASE_ORDER'a göre)."""
    normalized = _normalize(text)
    found: list[str] = []
    for phrase in PHRASE_ORDER:
        if phrase in normalized:
            found.append(phrase)
    return found


def infer_symptoms_and_levels_from_text(
    free_text: str,
    risk_level_terms: dict[str, set[str]],
) -> tuple[list[str], set[str]]:
    """
    Serbest metinden çıkarılan canonical semptom listesi ve tetiklenen risk seviyelerini döndürür.

    - Önce çok kelimeli ifadeleri kontrol eder, sonra tek kelimeleri.
    - Eşanlamlı haritadan canonical terime çevirir, risk seviyesi atar.
    """
    if not free_text or not free_text.strip():
        return [], set()

    inferred_canonical: list[str] = []
    triggered_levels: set[str] = set()

    text_norm = _normalize(free_text)

    # 1) Çok kelimeli ifadeler
    for phrase in _extract_phrases(free_text):
        canonical = SYNONYM_TO_CANONICAL.get(phrase)
        if not canonical:
            continue
        inferred_canonical.append(canonical)
        for level, terms in risk_level_terms.items():
            if canonical in terms:
                triggered_levels.add(level)
                break

    # 2) Tek kelimeler (ve 2 kelimelik birleşimler: "blood stool" gibi)
    tokens = _tokenize(free_text)
    seen_canonical: set[str] = set(inferred_canonical)

    for i, t in enumerate(tokens):
        # tek kelime
        c1 = SYNONYM_TO_CANONICAL.get(t)
        if c1 and c1 not in seen_canonical:
            seen_canonical.add(c1)
            inferred_canonical.append(c1)
            for level, terms in risk_level_terms.items():
                if c1 in terms:
                    triggered_levels.add(level)
                    break
        # 2 kelime: "blood stool" -> blood in faeces benzeri
        if i + 1 < len(tokens):
            two = f"{t} {tokens[i+1]}"
            c2 = SYNONYM_TO_CANONICAL.get(two)
            if c2 and c2 not in seen_canonical:
                seen_canonical.add(c2)
                inferred_canonical.append(c2)
                for level, terms in risk_level_terms.items():
                    if c2 in terms:
                        triggered_levels.add(level)
                        break

    # 3) Metin içinde geçen kelime grupları (örn. "frequent vomiting" -> vomiting)
    for key, canonical in SYNONYM_TO_CANONICAL.items():
        if " " in key:
            continue
        if key in text_norm and canonical not in seen_canonical:
            # Tam kelime sınırında olması tercih edilir
            if re.search(r"\b" + re.escape(key) + r"\b", text_norm):
                seen_canonical.add(canonical)
                inferred_canonical.append(canonical)
                for level, terms in risk_level_terms.items():
                    if canonical in terms:
                        triggered_levels.add(level)
                        break

    return inferred_canonical, triggered_levels


def _text_risk_levels(text: str, risk_level_terms: dict[str, set[str]]) -> set[str]:
    """Bir metinde geçen risk seviyelerini döndürür."""
    levels: set[str] = set()
    tl = text.lower()
    for level, terms in risk_level_terms.items():
        for term in terms:
            if term in tl:
                levels.add(level)
                break
    return levels


def search_knowledge_base_for_text(
    db_collection: Any,
    free_text: str,
    symptom_fields: list[str],
    risk_level_terms: dict[str, set[str]],
    adr_no: str | None = None,
) -> tuple[list[dict[str, Any]], set[str]]:
    """
    Serbest metindeki kelimelerle vet_knowledge_base'de arama yapar.
    Dönen: (eşleşen dokümanlar, doküman metinlerinde geçen risk seviyeleri).
    """
    tokens = _tokenize(free_text)
    if not tokens:
        return [], set()

    # Anlamlı kelimeler (en az 2 karakter, sadece sayı değil)
    meaningful = [t for t in tokens if len(t) >= 2 and not t.isdigit()]
    if not meaningful:
        return [], set()

    import re as re_mod
    or_clauses = []
    for field in symptom_fields:
        for t in meaningful:
            or_clauses.append({field: {"$regex": re_mod.escape(t), "$options": "i"}})

    query: dict[str, Any] = {"$or": or_clauses}
    if adr_no:
        adr = adr_no.strip()
        query = {
            "$and": [
                query,
                {"$or": [{"ADRNo": adr}, {"_id": adr}]},
            ]
        }

    cursor = db_collection.find(query).limit(200)
    matched_docs = list(cursor)

    levels_in_docs: set[str] = set()
    for doc in matched_docs:
        for field in symptom_fields:
            val = doc.get(field)
            if val is None:
                continue
            text = " ".join(map(str, val)) if isinstance(val, (list, tuple, set)) else str(val)
            levels_in_docs |= _text_risk_levels(text, risk_level_terms)

    return matched_docs, levels_in_docs
