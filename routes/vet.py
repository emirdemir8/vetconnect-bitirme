from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.db.mongo import get_db
from app.utils.risk_from_text import (
    infer_symptoms_and_levels_from_text,
    search_knowledge_base_for_text,
)


router = APIRouter(prefix="/vet", tags=["vet"])

# Tigress verisinde semptomların tutulduğu bilinen alanlar
KNOWN_SYMPTOM_FIELDS = {
    "SOC",
    "LLT: Lower Level Term",
    "HLT:Higher Level Term",
    "PT: Preffered Term",
}

# Kullanıcının tanımladığı risk seviyelerine göre anahtar terimler
RISK_LEVEL_TERMS: dict[str, set[str]] = {
    # Seviye 1: Kritik alarm (en ciddi)
    "level_1": {
        "death",
        "death by euthanasia",
        "digestive tract haemorrhage",
        "pneumonitis",
        "hyponatremia",
    },
    # Seviye 2: Yüksek risk
    "level_2": {
        "dehydration",
        "blood in faeces",
        "myopathy",
        "muscle wasting",
        "infectious disease nos",
    },
    # Seviye 3: Orta derece
    "level_3": {
        "emesis",
        "diarrhoea",
        "mucous stool",
        "hyperhidrosis",
    },
    # Seviye 4: Sistemik / operasyonel risk
    "level_4": {
        "lack of efficacy",
        "other abnormal test result",
    },
    # Seviye 5: Hafif / lokal
    "level_5": {
        "injection site reactions",
        "lethargy",
    },
}

SERIOUS_LEVELS = {"level_1", "level_2"}


def _symptom_to_levels_from_list(symptom: str) -> set[str]:
    """
    Kullanıcının girdiği semptom metnini doğrudan risk listeleriyle eşleştir.
    (Bu, özellikle injection site reactions gibi net terimler için kullanılır.)
    """
    s = symptom.strip().lower()
    levels: set[str] = set()
    for level, terms in RISK_LEVEL_TERMS.items():
        for term in terms:
            if s == term:
                levels.add(level)
    return levels


class SymptomCheckRequest(BaseModel):
    animal_species: str | None = Field(
        default=None,
        description="Hayvan türü/cins (örn: cat, dog, kedi, köpek). Dataset’te bu türe ait kayıtlar filtrelenir.",
    )
    product_or_vaccine: str | None = Field(
        default=None,
        description="Hangi aşı/ilaç sonrası (şüpheli ürün adı). Dataset’te bu ürüne ait kayıtlar filtrelenir.",
    )
    symptoms: list[str] = Field(
        default_factory=list,
        description="Liste halinde semptomlar (virgülle ayrılmış veya dizi)",
    )
    free_text: str | None = Field(
        default=None,
        description="Serbest metin / yorum (örn: 'We have frequent vomitting complaints in my cat'). Yorumdan anlam çıkarılıp risk ile eşleştirilir.",
    )
    adr_no: str | None = Field(
        default=None,
        description="Varsa ilgili ADRNo (Tigress kaydının numarası)",
    )

    @model_validator(mode="after")
    def require_symptoms_or_free_text(self):
        terms = [t.strip() for t in self.symptoms if t and t.strip()]
        ft = (self.free_text or "").strip()
        if not terms and not ft:
            raise ValueError("En az bir semptom veya serbest metin (free_text) girilmelidir.")
        return self


class SymptomCheckResponse(BaseModel):
    serious: bool
    risk_level: int | None = Field(
        default=None, description="1=kritik, 2=yüksek, 3=orta, 4=sistemik, 5=hafif, None=bulunamadı"
    )
    risk_label: str | None = Field(
        default=None, description="İnsan okunur seviye açıklaması"
    )
    matched_symptoms: list[str]
    matched_records: int
    reasons: list[str]
    inferred_symptoms: list[str] = Field(
        default_factory=list,
        description="Serbest metinden çıkarılan (eşanlamlı eşleşen) semptom terimleri",
    )


def _infer_symptom_fields(example_doc: dict[str, Any]) -> list[str]:
    """
    Belge anahtarlarına göre semptom alanlarını tahmin et.
    """
    keys = list(example_doc.keys())
    symptom_fields: list[str] = []
    # Önce bilinen semptom alanlarını ekle
    for k in keys:
        if k in KNOWN_SYMPTOM_FIELDS:
            symptom_fields.append(k)
    # Sonra isimden tahmin
    for k in keys:
        kl = k.lower()
        if kl == "_id":
            continue
        if "symptom" in kl or "sign" in kl or "klinik" in kl:
            symptom_fields.append(k)
    # Eğer hala semptom alanı yakalayamazsak, string ağırlıklı kolonları fallback olarak kullan
    if not symptom_fields:
        for k, v in example_doc.items():
            kl = k.lower()
            if kl in {"_id", "adrno"}:
                continue
            if isinstance(v, (str, list, tuple, set)) or v is None:
                symptom_fields.append(k)
    return symptom_fields


def _infer_animal_fields(example_doc: dict[str, Any]) -> list[str]:
    """Hayvan türü/cins bilgisinin tutulduğu alanları tahmin et (Species, Animal, Breed vb.)."""
    out: list[str] = []
    for k in example_doc.keys():
        kl = k.lower()
        if kl in {"_id", "adrno"}:
            continue
        if any(x in kl for x in ("species", "animal", "breed", "tür", "cins", "genus")):
            out.append(k)
    return out


def _infer_product_fields(example_doc: dict[str, Any]) -> list[str]:
    """Şüpheli ürün/aşı/ilaç bilgisinin tutulduğu alanları tahmin et (Drug, Product, Vaccine, SAR vb.)."""
    out: list[str] = []
    for k in example_doc.keys():
        kl = k.lower()
        if kl in {"_id", "adrno"}:
            continue
        if any(x in kl for x in ("drug", "product", "vaccine", "suspect", "medic", "ilaç", "aşı", "sar", "active", "trade")):
            out.append(k)
    return out


def _text_risk_levels(text: str) -> set[str]:
    """
    Bir metnin içinde geçen risk seviyelerini döndür.
    """
    levels: set[str] = set()
    tl = text.lower()
    for level, terms in RISK_LEVEL_TERMS.items():
        for term in terms:
            if term in tl:
                levels.add(level)
                break
    return levels


@router.post("/check-serious", response_model=SymptomCheckResponse)
def check_serious(payload: SymptomCheckRequest):
    """
    Girilen semptomlara ve/veya serbest metne (yorum) göre Tigress tabanlı ciddiyet kontrolü.

    - Serbest metin verilirse yorumdan anlam çıkarılır (eşanlamlılar: vomitting→emesis vb.),
      dataset ile karşılaştırılıp risk seviyesi ve geri bildirim üretilir.
    - Hem semptom listesi hem serbest metin verilebilir; ikisi birleştirilerek değerlendirilir.
    """
    db = get_db()
    col = db["vet_knowledge_base"]

    example = col.find_one()
    if not example:
        raise HTTPException(status_code=500, detail="Bilgi bankası boş görünüyor.")

    symptom_fields = _infer_symptom_fields(example)
    animal_fields = _infer_animal_fields(example)
    product_fields = _infer_product_fields(example)

    # Açık semptom listesi
    terms_explicit = [t.strip() for t in payload.symptoms if t and t.strip()]

    # Serbest metinden çıkarılan semptomlar ve tetiklenen seviyeler
    inferred_canonical: list[str] = []
    triggered_levels_from_free_text: set[str] = set()
    if payload.free_text and payload.free_text.strip():
        inferred_canonical, triggered_levels_from_free_text = infer_symptoms_and_levels_from_text(
            payload.free_text.strip(), RISK_LEVEL_TERMS
        )

    # Birleşik terim listesi (gösterim ve DB sorgusu için)
    terms = list(dict.fromkeys(terms_explicit + inferred_canonical))
    if not terms:
        terms = inferred_canonical

    # Sadece serbest metin ile tetiklenen seviyeler + açık semptom listesinden tetiklenenler
    triggered_levels_from_input: set[str] = set()
    for term in terms_explicit:
        triggered_levels_from_input |= _symptom_to_levels_from_list(term)
    triggered_levels_merged = triggered_levels_from_input | triggered_levels_from_free_text

    # Sorgu parçaları: semptom + hayvan türü + ürün/aşı + ADRNo
    and_parts: list[dict[str, Any]] = []

    if terms:
        or_clauses = []
        for field in symptom_fields:
            for term in terms:
                or_clauses.append({field: {"$regex": re.escape(term), "$options": "i"}})
        and_parts.append({"$or": or_clauses})

    animal_filter = (payload.animal_species or "").strip()
    if animal_filter and animal_fields:
        and_parts.append({
            "$or": [
                {f: {"$regex": re.escape(animal_filter), "$options": "i"}}
                for f in animal_fields
            ]
        })

    product_filter = (payload.product_or_vaccine or "").strip()
    if product_filter and product_fields:
        and_parts.append({
            "$or": [
                {f: {"$regex": re.escape(product_filter), "$options": "i"}}
                for f in product_fields
            ]
        })

    if payload.adr_no:
        adr = payload.adr_no.strip()
        and_parts.append({"$or": [{"ADRNo": adr}, {"_id": adr}]})

    matched_docs = []
    if and_parts:
        query: dict[str, Any] = {"$and": and_parts} if len(and_parts) > 1 else and_parts[0]
        matched_docs = list(col.find(query).limit(200))

    # Serbest metin verilip terim eşleşmesi az/boşsa, metin kelimeleriyle DB'de ara
    if (payload.free_text and payload.free_text.strip()) and len(matched_docs) < 50:
        docs_ft, levels_in_docs = search_knowledge_base_for_text(
            col, payload.free_text.strip(), symptom_fields, RISK_LEVEL_TERMS, payload.adr_no
        )
        if docs_ft and not matched_docs:
            matched_docs = docs_ft
            triggered_levels_merged |= levels_in_docs
        elif docs_ft:
            # Birleşik kayıt sayısı için ek eşleşmeleri de sayabiliriz; şimdilik tetiklenen seviyeleri birleştiriyoruz
            triggered_levels_merged |= levels_in_docs

    # Eşleşen terimler (doküman metinlerinde geçen)
    matched_terms: set[str] = set()
    triggered_levels_from_text: set[str] = set()
    for doc in matched_docs:
        for field in symptom_fields:
            val = doc.get(field)
            if val is None:
                continue
            text = " ".join(map(str, val)) if isinstance(val, (list, tuple, set)) else str(val)
            tl = text.lower()
            for term in terms:
                if term.lower() in tl:
                    matched_terms.add(term)
            triggered_levels_from_text |= _text_risk_levels(text)

    # Nihai risk seviyesi: kullanıcı girişi (açık + serbest metinden çıkarılan) birleşik seviyelerden
    ordered_levels = ["level_1", "level_2", "level_3", "level_4", "level_5"]
    overall_level_name: str | None = None
    for lvl in ordered_levels:
        if lvl in triggered_levels_merged:
            overall_level_name = lvl
            break

    level_number: int | None = None
    level_label: str | None = None
    if overall_level_name:
        level_number = int(overall_level_name.split("_")[1])
        level_label = {
            1: "Seviye 1: Kritik alarm (acil müdahale / ölüm riski)",
            2: "Seviye 2: Yüksek risk (hızlı kötüleşme potansiyeli)",
            3: "Seviye 3: Orta derece (yakın takip gerektirir)",
            4: "Seviye 4: Sistemik / operasyonel risk",
            5: "Seviye 5: Hafif / lokal",
        }.get(level_number)

    serious_any = overall_level_name in SERIOUS_LEVELS

    reasons: list[str] = []
    if animal_filter:
        reasons.append(f"Hayvan türü/cins filtresi: '{animal_filter}' (dataset’te bu türe göre filtrelendi).")
    if product_filter:
        reasons.append(f"Ürün/aşı filtresi: '{product_filter}' (hangi aşı/ilaç sonrası belirtildi).")
    if inferred_canonical:
        reasons.append(f"Serbest metinden çıkarılan semptomlar: {', '.join(inferred_canonical)}.")
    if overall_level_name:
        reasons.append(f"Genel risk seviyesi: {level_label}.")
    else:
        reasons.append("Girilen ifadeler tanımlı risk seviyeleri ile eşleşmedi (eşanlamlılar ve dataset kontrol edildi).")
    if triggered_levels_from_text:
        reasons.append(f"Tigress kayıtlarında görülen seviyeler: {', '.join(sorted(triggered_levels_from_text))}.")
    if serious_any:
        reasons.append("Seviye 1 veya 2 eşleşmesi nedeniyle 'ciddi' kabul edildi.")
    else:
        reasons.append("Seviye 1-2 eşleşmesi yok; 'ciddi' kabul edilmedi.")
    if payload.adr_no:
        reasons.append(f"ADRNo filtresi: {payload.adr_no}")

    return SymptomCheckResponse(
        serious=serious_any,
        risk_level=level_number,
        risk_label=level_label,
        matched_symptoms=sorted(matched_terms) or sorted(inferred_canonical),
        matched_records=len(matched_docs),
        reasons=reasons,
        inferred_symptoms=inferred_canonical,
    )


@router.get("/risk-terms")
def risk_terms():
    """
    Tanımlı risk seviyeleri ve ilgili terimleri döndür.
    Frontend, yardım metinleri ve referans için kullanabilir.
    """
    labels = {
        "level_1": "Seviye 1: Kritik alarm (acil müdahale / ölüm riski)",
        "level_2": "Seviye 2: Yüksek risk (hızlı kötüleşme potansiyeli)",
        "level_3": "Seviye 3: Orta derece (yakın takip gerektirir)",
        "level_4": "Seviye 4: Sistemik / operasyonel risk",
        "level_5": "Seviye 5: Hafif / lokal",
    }
    return {
        "levels": [
            {"id": name, "label": labels.get(name), "terms": sorted(list(terms))}
            for name, terms in RISK_LEVEL_TERMS.items()
        ],
        "serious_levels": sorted(list(SERIOUS_LEVELS)),
    }

