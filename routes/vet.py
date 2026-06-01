from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, model_validator

from app.ml.serious_model import get_serious_predictor, load_symptom_options_from_csv
from app.utils.owner_guidance import generate_owner_guidance
from app.utils.symptom_inference import infer_llts_from_text, merge_symptom_lists
from app.utils.symptom_risk_floor import apply_symptom_risk_floor


router = APIRouter(prefix="/vet", tags=["vet"])


class SymptomCheckRequest(BaseModel):
    animal_species: str | None = Field(
        default=None,
        description="Animal species (e.g. cat, dog).",
    )
    product_or_vaccine: str | None = Field(
        default=None,
        description="Selected vaccine / suspected product name.",
    )
    symptoms: list[str] = Field(
        default_factory=list,
        description="Symptoms selected from dataset or added manually",
    )
    free_text: str | None = Field(
        default=None,
        description="Free-text symptom description; matched to dataset LLT labels when possible",
    )
    adr_no: str | None = Field(
        default=None,
        description="Optional ADRNo",
    )
    include_owner_guidance: bool = Field(
        default=False,
        description="If true, include short owner guidance (OpenAI if configured, else template).",
    )
    pet_name: str | None = Field(
        default=None,
        max_length=120,
        description="Used with include_owner_guidance in guidance text",
    )

    @model_validator(mode="after")
    def require_symptoms_or_free_text(self):
        terms = [t.strip() for t in self.symptoms if t and t.strip()]
        ft = (self.free_text or "").strip()
        if not terms and not ft:
            raise ValueError(
                "Select at least one symptom from the list or describe what you are seeing (free_text)."
            )
        return self


class SymptomCheckResponse(BaseModel):
    serious: bool
    risk_level: int | None = Field(
        default=None, description="Model-based risk level 1–5"
    )
    risk_label: str | None = Field(default=None, description="Human-readable level label")
    matched_symptoms: list[str]
    matched_records: int
    reasons: list[str]
    inferred_symptoms: list[str] = Field(
        default_factory=list,
        description="Legacy field; may be empty for ML-only flow",
    )
    ml_serious_probability: float | None = Field(
        default=None,
        description="Model P(Serious=Y), 0–1",
    )
    owner_guidance: str | None = Field(
        default=None,
        description="Short guidance text for owner (AI or template)",
    )
    owner_guidance_source: str | None = Field(
        default=None,
        description="openai | template",
    )


@router.get("/symptom-options")
def list_symptom_options(limit: int = Query(2000, ge=20, le=2000)):
    """LLT symptom labels from Animal Symptoms.csv (multi-select)."""
    try:
        items = load_symptom_options_from_csv(limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load symptom list: {e!s}") from e
    return {"items": [{"value": s, "label": s} for s in items]}


@router.get("/ml-model-status")
def ml_model_status():
    """Model training and validation summary."""
    pred = get_serious_predictor()
    if not pred.ready:
        return {
            "ready": False,
            "error": pred.load_error or "Unknown error",
        }
    return {
        "ready": True,
        "training_rows": pred.n_rows,
        "holdout_accuracy": pred.holdout_accuracy,
        "holdout_roc_auc": pred.holdout_roc_auc,
        "model": "tfidf_logistic_regression",
        "data_source": "data/*.csv (TigressADR-Animal, Animal Symptoms, SAR)",
    }


@router.post("/check-serious", response_model=SymptomCheckResponse)
def check_serious(payload: SymptomCheckRequest):
    """
    Serious (Y/N) probability and risk level using TF-IDF + logistic regression
    trained on the merged CSV dataset.
    """
    pred = get_serious_predictor()
    if not pred.ready:
        raise HTTPException(
            status_code=503,
            detail=f"ML model could not load: {pred.load_error or 'unknown'}",
        )

    terms = [t.strip() for t in payload.symptoms if t and t.strip()]
    free = (payload.free_text or "").strip() or None
    animal = (payload.animal_species or "").strip() or None
    product = (payload.product_or_vaccine or "").strip() or None

    inferred: list[str] = []
    if free:
        try:
            vocab = load_symptom_options_from_csv(limit=2000)
            inferred = infer_llts_from_text(free, vocab)
        except Exception:
            inferred = infer_llts_from_text(free)

    merged_symptoms = merge_symptom_lists(terms, inferred)
    if not merged_symptoms and free:
        merged_symptoms = []

    try:
        out = pred.predict(
            symptoms=merged_symptoms,
            free_text=free,
            animal_species=animal,
            product_or_vaccine=product,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {e!s}") from e

    out = apply_symptom_risk_floor(out, merged_symptoms)

    if payload.adr_no and str(payload.adr_no).strip():
        out["reasons"] = list(out["reasons"]) + [
            f"Note: ADRNo provided ({payload.adr_no.strip()}); prediction uses all text features."
        ]

    og: str | None = None
    og_src: str | None = None
    reasons = list(out.get("reasons") or [])
    if payload.include_owner_guidance:
        reasons = []

    if payload.include_owner_guidance:
        og, og_src = generate_owner_guidance(
            pet_name=(payload.pet_name or "").strip() or None,
            animal_species=animal,
            product_or_vaccine=product,
            symptoms=merged_symptoms,
            selected_symptoms=terms,
            inferred_symptoms=inferred,
            free_text=free,
            serious=bool(out["serious"]),
            risk_level=out.get("risk_level"),
            risk_label=out.get("risk_label"),
            ml_proba=out.get("ml_serious_probability"),
        )

    return SymptomCheckResponse(
        serious=bool(out["serious"]),
        risk_level=out["risk_level"],
        risk_label=out["risk_label"],
        matched_symptoms=merged_symptoms or out["matched_symptoms"],
        matched_records=int(out["matched_records"]),
        reasons=reasons,
        inferred_symptoms=inferred,
        ml_serious_probability=out.get("ml_serious_probability"),
        owner_guidance=og,
        owner_guidance_source=og_src,
    )


@router.get("/risk-terms")
def risk_terms():
    """
    Backward compatibility: meaning of the risk levels (a keyword list is no longer used).
    """
    pred = get_serious_predictor()
    return {
        "levels": [
            {"id": "level_1", "label": "Level 1: Highest model probability", "terms": []},
            {"id": "level_2", "label": "Level 2: High", "terms": []},
            {"id": "level_3", "label": "Level 3: Moderate", "terms": []},
            {"id": "level_4", "label": "Level 4: Low–moderate", "terms": []},
            {"id": "level_5", "label": "Level 5: Low", "terms": []},
        ],
        "serious_levels": ["level_1", "level_2"],
        "ml_ready": pred.ready,
        "note": "Predictions use only the ML model trained on CSV files in data/; no fixed keyword rules.",
    }
