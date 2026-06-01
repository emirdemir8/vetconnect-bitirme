"""Short owner guidance after pre-check (template or OpenAI)."""

from __future__ import annotations



import json

import logging

import urllib.error

import urllib.request

from typing import Any



from app.core.config import settings

from app.utils.sanitize import sanitize_text



logger = logging.getLogger(__name__)



_RISK_HEADLINES: dict[int, str] = {

    1: "Critical symptoms were reported — seek veterinary care immediately.",

    2: "Please reach out to your veterinarian today.",

    3: "A vet visit within the next day or two would be sensible.",

    4: "Keep a close eye on your pet and book a check-up if anything changes.",

    5: "Symptoms look milder in our comparison, but your vet is still the best guide.",

}





def _symptom_phrase(

    symptoms: list[str],

    *,

    selected_symptoms: list[str] | None = None,

    inferred_symptoms: list[str] | None = None,

) -> str:

    selected = [s for s in (selected_symptoms or symptoms) if s and str(s).strip()]

    inferred = [s for s in (inferred_symptoms or []) if s and str(s).strip()]

    if selected and inferred:

        extra = [s for s in inferred if s not in selected]

        if extra:

            return f"{', '.join(selected[:6])} (we also matched: {', '.join(extra[:4])})"

        return ", ".join(selected[:8])

    if symptoms:

        return ", ".join(symptoms[:8])

    return "the symptoms you described"





def _template_guidance(

    *,

    pet_name: str | None,

    animal_species: str | None,

    product_or_vaccine: str | None,

    symptoms: list[str],

    selected_symptoms: list[str] | None = None,

    inferred_symptoms: list[str] | None = None,

    free_text: str | None,

    serious: bool,

    risk_level: int | None,

    risk_label: str | None,

    ml_proba: float | None,

) -> str:

    who = (pet_name or "").strip() or "your pet"

    species = (animal_species or "").strip()

    vac = (product_or_vaccine or "").strip() or "the product you selected"

    sym_phrase = _symptom_phrase(

        symptoms,

        selected_symptoms=selected_symptoms,

        inferred_symptoms=inferred_symptoms,

    )

    extra = (free_text or "").strip()

    lvl = risk_level if risk_level is not None else None

    headline = _RISK_HEADLINES.get(lvl, "If you are worried, your veterinarian can help you decide next steps.")



    lines = [
        f"{who}: {vac}; symptoms — {sym_phrase}.",
        headline,
    ]

    if inferred_symptoms and selected_symptoms:
        only_inferred = [s for s in inferred_symptoms if s not in selected_symptoms]
        if only_inferred:
            lines.append("Matched from note: " + ", ".join(only_inferred[:5]) + ".")

    if extra and not inferred_symptoms:
        lines.append(f"Note: {extra[:120]}{'…' if len(extra) > 120 else ''}")

    lines.append("Pre-check only; not a diagnosis.")



    if lvl == 1:
        lines.extend(
            [
                "• Contact your veterinarian immediately.",
                "• If your pet is in distress, go to emergency care now.",
            ]
        )
    elif serious or (lvl is not None and lvl <= 2):
        lines.extend(
            [
                "• Contact your vet today.",
                "• Emergency care if collapse, breathing trouble, or repeated vomiting.",
            ]
        )
    elif lvl is not None and lvl <= 4:
        lines.extend(
            [
                "• Vet visit within 24–48 h if symptoms continue.",
                "• Monitor appetite, energy, and drinking.",
            ]
        )
    else:
        lines.extend(
            [
                "• Monitor at home; call your vet if symptoms persist.",
                "• Report saved for your veterinarian.",
            ]
        )

    return "\n".join(lines)





def _openai_chat(messages: list[dict[str, str]], *, timeout: float = 28.0) -> str | None:

    key = settings.openai_api_key

    if not key:

        return None

    url = f"{settings.openai_base_url}/chat/completions"

    body: dict[str, Any] = {

        "model": settings.openai_model,

        "messages": messages,

        "max_tokens": 550,

        "temperature": 0.35,

    }

    data = json.dumps(body, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(

        url,

        data=data,

        method="POST",

        headers={

            "Authorization": f"Bearer {key}",

            "Content-Type": "application/json",

        },

    )

    try:

        with urllib.request.urlopen(req, timeout=timeout) as resp:

            raw = json.loads(resp.read().decode("utf-8"))

    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, KeyError) as e:

        logger.warning("OpenAI owner guidance failed: %s", e)

        return None

    try:

        return str(raw["choices"][0]["message"]["content"]).strip()

    except (KeyError, IndexError, TypeError):

        return None





def generate_owner_guidance(

    *,

    pet_name: str | None,

    animal_species: str | None,

    product_or_vaccine: str | None,

    symptoms: list[str],

    selected_symptoms: list[str] | None = None,

    inferred_symptoms: list[str] | None = None,

    free_text: str | None,

    serious: bool,

    risk_level: int | None,

    risk_label: str | None,

    ml_proba: float | None,

) -> tuple[str, str]:

    template = _template_guidance(

        pet_name=pet_name,

        animal_species=animal_species,

        product_or_vaccine=product_or_vaccine,

        symptoms=symptoms,

        selected_symptoms=selected_symptoms,

        inferred_symptoms=inferred_symptoms,

        free_text=free_text,

        serious=serious,

        risk_level=risk_level,

        risk_label=risk_label,

        ml_proba=ml_proba,

    )



    if not settings.openai_api_key:

        return template, "template"



    ctx = {

        "pet_name": pet_name,

        "animal_species": animal_species,

        "product_or_vaccine": product_or_vaccine,

        "symptoms": symptoms,

        "selected_symptoms": selected_symptoms or symptoms,

        "inferred_symptoms": inferred_symptoms or [],

        "free_text": free_text,

        "serious": serious,

        "risk_level": risk_level,

        "risk_label": risk_label,

    }

    user_blob = json.dumps(ctx, ensure_ascii=False, indent=2)

    system = (

        "You write warm, clear English guidance for pet owners after a symptom pre-check. "

        "Use the pet's name when provided. Do not diagnose or recommend drugs or doses. "

        "Say this is not a substitute for a veterinary exam. Avoid technical ML jargon "

        "(no TF-IDF, logistic regression, datasets, or probabilities). "

        "Max ~100 words; bullets only. Match urgency to risk_level (1=urgent, 5=calmer)."

    )

    user = "Write owner-facing guidance from this pre-check JSON:\n\n" + user_blob

    ai = _openai_chat(

        [

            {"role": "system", "content": system},

            {"role": "user", "content": user},

        ]

    )

    if ai:

        cleaned = sanitize_text(ai, max_length=4000)

        if cleaned:

            return cleaned, "openai"

    return template, "template"


