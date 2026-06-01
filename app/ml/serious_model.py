"""
TigressADR + Animal Symptoms + SAR CSV birleşiminden Serious (Y/N) tahmini.

Eğitim: TF-IDF metin özellikleri + dengeli lojistik regresyon (scikit-learn).
Tahmin: kullanıcı semptomları, serbest metin, tür ve seçilen aşı adı tek metin olarak vektörize edilir.
"""
from __future__ import annotations

import logging
import math
import threading
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import NearestNeighbors
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[2]

_TEXT_COLUMNS = [
    "AnimalSpecies",
    "AnimalClass",
    "AnimalBreed",
    "SOC",
    "HLT:Higher Level Term",
    "PT: Preffered Term",
    "LLT: Lower Level Term",
    "IncidentType",
    "SARType",
    "ReportType",
]

_lock = threading.Lock()
_predictor: "SeriousMLPredictor | None" = None


def _flatten_cell(val: Any) -> str:
    if val is None:
        return ""
    if isinstance(val, float) and math.isnan(val):
        return ""
    if isinstance(val, (list, tuple)):
        return " ".join(str(x).strip() for x in val if x is not None and str(x).strip())
    s = str(val).strip()
    if s.lower() in ("nan", "none"):
        return ""
    return s


def _row_to_training_text(row: pd.Series) -> str:
    parts: list[str] = []
    for col in _TEXT_COLUMNS:
        if col not in row.index:
            continue
        t = _flatten_cell(row[col])
        if t:
            parts.append(t)
    return " ".join(parts).lower()


def _user_document(
    symptoms: list[str],
    free_text: str | None,
    animal_species: str | None,
    product_or_vaccine: str | None,
) -> str:
    parts: list[str] = []
    if animal_species and str(animal_species).strip():
        parts.append(str(animal_species).strip())
    if product_or_vaccine and str(product_or_vaccine).strip():
        parts.append(str(product_or_vaccine).strip())
    for s in symptoms:
        if s and str(s).strip():
            parts.append(str(s).strip())
    if free_text and str(free_text).strip():
        parts.append(str(free_text).strip())
    return " ".join(parts).lower()


def _proba_to_risk_level(p: float) -> tuple[int, str]:
    """Olasılığı mevcut arayüz seviyelerine (1–5) eşle."""
    if p >= 0.82:
        return 1, "Level 1: High seriousness probability (approx. 82%+)."
    if p >= 0.62:
        return 2, "Level 2: Moderate–high seriousness probability."
    if p >= 0.42:
        return 3, "Level 3: Moderate seriousness probability; monitoring advised."
    if p >= 0.22:
        return 4, "Level 4: Low–moderate probability."
    return 5, "Level 5: Low seriousness probability."


class SeriousMLPredictor:
    def __init__(self) -> None:
        self.pipeline: Pipeline | None = None
        self._nn: NearestNeighbors | None = None
        self._X_train: Any = None
        self._train_adr: list[str] = []
        self._train_y: np.ndarray | None = None
        self.n_rows: int = 0
        self.holdout_accuracy: float | None = None
        self.holdout_roc_auc: float | None = None
        self._error: str | None = None

    @property
    def ready(self) -> bool:
        return self.pipeline is not None

    @property
    def load_error(self) -> str | None:
        return self._error

    def fit_from_merged_frame(self, df: pd.DataFrame) -> None:
        if "Serious" not in df.columns or "ADRNo" not in df.columns:
            raise ValueError("Merged dataset must include Serious and ADRNo columns.")

        work = df.copy()
        work["Serious"] = work["Serious"].astype(str).str.strip().str.upper()
        work = work[work["Serious"].isin(("Y", "N"))].copy()
        work["_text"] = work.apply(_row_to_training_text, axis=1)
        work = work[work["_text"].str.len() > 10].copy()
        y = (work["Serious"] == "Y").astype(int).values
        texts = work["_text"].tolist()
        adr = work["ADRNo"].astype(str).str.strip().tolist()

        if len(texts) < 200:
            raise ValueError(f"Not enough training rows ({len(texts)}).")

        self.n_rows = len(texts)

        idx_all = np.arange(len(texts))
        X_train, X_test, y_train, y_test, idx_train, idx_test = train_test_split(
            texts,
            y,
            idx_all,
            test_size=0.2,
            random_state=42,
            stratify=y,
        )

        pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        max_features=8000,
                        min_df=2,
                        max_df=0.92,
                        ngram_range=(1, 2),
                        sublinear_tf=True,
                    ),
                ),
                (
                    "clf",
                    LogisticRegression(
                        max_iter=250,
                        class_weight="balanced",
                        random_state=42,
                        solver="liblinear",
                        dual=False,
                    ),
                ),
            ]
        )
        pipeline.fit(X_train, y_train)
        self.pipeline = pipeline

        proba_test = pipeline.predict_proba(X_test)[:, 1]
        self.holdout_accuracy = float(accuracy_score(y_test, (proba_test >= 0.5).astype(int)))
        try:
            self.holdout_roc_auc = float(roc_auc_score(y_test, proba_test))
        except ValueError:
            self.holdout_roc_auc = None

        tfidf = pipeline.named_steps["tfidf"]
        X_tr_sparse = tfidf.transform(X_train)
        k = min(12, X_tr_sparse.shape[0])
        self._nn = NearestNeighbors(n_neighbors=k, metric="cosine")
        self._nn.fit(X_tr_sparse)
        self._X_train = X_tr_sparse
        self._train_adr = [adr[int(i)] for i in idx_train]
        self._train_y = y_train

        logger.info(
            "ADR Serious ML: trained on %s rows; holdout acc=%.3f roc_auc=%s",
            self.n_rows,
            self.holdout_accuracy,
            f"{self.holdout_roc_auc:.3f}" if self.holdout_roc_auc is not None else "n/a",
        )

    def predict(
        self,
        symptoms: list[str],
        free_text: str | None,
        animal_species: str | None,
        product_or_vaccine: str | None,
    ) -> dict[str, Any]:
        if not self.pipeline:
            raise RuntimeError("Model is not trained.")

        doc = _user_document(symptoms, free_text, animal_species, product_or_vaccine)
        if len(doc.strip()) < 2:
            raise ValueError("Not enough text for prediction.")

        proba = float(self.pipeline.predict_proba([doc])[0, 1])
        serious = proba >= 0.5
        level, label = _proba_to_risk_level(proba)

        matched_symptoms = [s.strip() for s in symptoms if s and str(s).strip()]
        reasons: list[str] = [
            "Assessment: TF-IDF + logistic regression trained on merged TigressADR + Animal Symptoms + SAR "
            f"({self.n_rows} training rows).",
            f"Estimated serious (Serious=Y) probability: {proba:.2%}.",
        ]
        if self.holdout_accuracy is not None:
            reasons.append(f"(Holdout accuracy on validation set ≈ {self.holdout_accuracy:.0%}.)")

        tfidf = self.pipeline.named_steps["tfidf"]
        xu = tfidf.transform([doc])
        matched_records = 0
        neighbor_adr: list[str] = []
        neighbor_serious: list[bool] = []

        if self._nn is not None and self._X_train is not None:
            dist, ind = self._nn.kneighbors(xu, return_distance=True)
            ind0, dist0 = ind[0], dist[0]
            matched_records = int(sum(1 for d in dist0 if d < 0.55))
            if matched_records == 0:
                matched_records = len(ind0)
            for j, di in zip(ind0, dist0):
                if di < 0.72:
                    neighbor_adr.append(self._train_adr[j])
                    neighbor_serious.append(bool(self._train_y[j]))  # type: ignore[index]

        if neighbor_adr:
            reasons.append(
                "Similar training ADRNo examples: "
                + ", ".join(f"{a} ({'Y' if s else 'N'})" for a, s in zip(neighbor_adr[:5], neighbor_serious[:5]))
                + "."
            )

        return {
            "serious": serious,
            "risk_level": level,
            "risk_label": label,
            "matched_symptoms": matched_symptoms,
            "matched_records": matched_records,
            "reasons": reasons,
            "inferred_symptoms": [],
            "ml_serious_probability": proba,
        }


def _train_from_csv() -> SeriousMLPredictor:
    from scripts.load_reference_data import build_reference_dataframe

    p = SeriousMLPredictor()
    df = build_reference_dataframe()
    p.fit_from_merged_frame(df)
    return p


def get_serious_predictor() -> SeriousMLPredictor:
    """İlk çağrıda veri setinden eğitir; sonraki çağrılar önbelleği kullanır."""
    global _predictor
    if _predictor is not None and _predictor.ready:
        return _predictor
    with _lock:
        if _predictor is not None and _predictor.ready:
            return _predictor
        pred = SeriousMLPredictor()
        try:
            pred = _train_from_csv()
        except Exception as e:
            logger.exception("ADR ML model eğitilemedi: %s", e)
            pred._error = str(e)
        _predictor = pred
        return _predictor


def load_symptom_options_from_csv(limit: int = 400) -> list[str]:
    """Animal Symptoms.csv içinden sık LLT etiketleri (çoklu seçim için)."""
    path = _ROOT / "data" / "Animal Symptoms.csv"
    if not path.exists():
        return []
    last_err: Exception | None = None
    df = None
    for enc in ("utf-8", "utf-8-sig", "cp1252", "latin1"):
        try:
            df = pd.read_csv(path, encoding=enc, sep=None, engine="python")
            break
        except UnicodeDecodeError as e:
            last_err = e
    if df is None:
        raise last_err  # type: ignore[misc]
    df.columns = [str(c).strip() for c in df.columns]
    col = "LLT: Lower Level Term"
    if col not in df.columns:
        return []
    s = df[col].dropna().astype(str).str.strip()
    s = s[s.str.len() > 1]
    top = s.value_counts().head(max(1, min(limit, 2000))).index.tolist()
    return top
