"""
models/categorizer.py — Expense categorization using TF-IDF + LinearSVC
Supports online feedback loop for model improvement.
"""

import os
import json
import logging
import numpy as np
import joblib
from pathlib import Path
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.calibration import CalibratedClassifierCV
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder

logger = logging.getLogger(__name__)

MODEL_PATH = Path("models/saved/categorizer.pkl")
FEEDBACK_PATH = Path("data/feedback.jsonl")
TRAINING_DATA_PATH = Path("data/training_data.json")

CATEGORIES = [
    "Food & Dining", "Transport", "Shopping", "Entertainment",
    "Bills & Utilities", "Health & Medical", "Travel", "Education",
    "Housing", "Personal Care", "Sports & Fitness", "Gifts & Donations",
    "Investments", "Other",
]

# Keyword-based feature engineering
CATEGORY_KEYWORDS = {
    "Food & Dining": [
        "food", "restaurant", "cafe", "coffee", "lunch", "dinner", "breakfast",
        "pizza", "burger", "grocery", "groceries", "supermarket", "meal",
        "sushi", "mcdonalds", "kfc", "zomato", "swiggy", "ubereats", "doordash",
        "starbucks", "bakery", "snack", "drink", "bar", "pub",
    ],
    "Transport": [
        "uber", "ola", "lyft", "taxi", "cab", "bus", "metro", "train", "fuel",
        "petrol", "diesel", "parking", "toll", "flight", "airfare", "transport",
        "commute", "fare", "ticket", "auto", "rickshaw", "rapido",
    ],
    "Shopping": [
        "amazon", "flipkart", "myntra", "shopping", "clothes", "shirt", "shoes",
        "dress", "bag", "accessories", "watch", "electronics", "gadget", "online",
        "order", "purchase", "buy", "mall", "store", "walmart", "target",
    ],
    "Entertainment": [
        "netflix", "spotify", "amazon prime", "movie", "cinema", "theatre",
        "concert", "show", "game", "gaming", "steam", "play", "entertainment",
        "subscription", "music", "disney", "hulu", "youtube", "app",
    ],
    "Bills & Utilities": [
        "electricity", "water", "gas", "internet", "wifi", "phone", "mobile",
        "bill", "utility", "rent", "insurance", "emi", "loan", "recharge",
        "dth", "cable", "broadband", "airtel", "jio", "verizon", "at&t",
    ],
    "Health & Medical": [
        "doctor", "hospital", "medicine", "pharmacy", "medical", "health",
        "clinic", "dentist", "gym", "chemist", "prescription", "consultation",
        "lab", "test", "healthcare", "therapy", "wellness",
    ],
    "Travel": [
        "hotel", "booking", "airbnb", "vacation", "holiday", "trip", "resort",
        "travel", "tour", "visa", "passport", "luggage", "suitcase", "makemytrip",
        "expedia", "airlines", "boarding",
    ],
    "Education": [
        "course", "udemy", "coursera", "book", "textbook", "tuition", "school",
        "college", "university", "fee", "education", "learning", "class",
        "workshop", "seminar", "certification", "exam",
    ],
    "Housing": [
        "rent", "mortgage", "maintenance", "repair", "furniture", "appliance",
        "housing", "apartment", "home", "house", "flat", "deposit",
    ],
    "Personal Care": [
        "salon", "haircut", "spa", "beauty", "cosmetics", "skincare", "soap",
        "shampoo", "makeup", "grooming", "barber", "nails", "waxing",
    ],
    "Sports & Fitness": [
        "gym", "fitness", "yoga", "sport", "cricket", "football", "tennis",
        "swimming", "cycling", "equipment", "nike", "adidas", "protein",
    ],
    "Gifts & Donations": [
        "gift", "donation", "charity", "present", "birthday", "wedding",
        "anniversary", "ngo", "fundraiser",
    ],
    "Investments": [
        "investment", "mutual fund", "stocks", "shares", "sip", "crypto",
        "bitcoin", "savings", "deposit", "fd", "ppf", "nps",
    ],
}


def extract_keyword_features(description: str) -> dict:
    """Generate keyword match scores per category."""
    desc_lower = description.lower()
    features = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in desc_lower)
        features[category] = score
    return features


def build_enhanced_text(description: str, amount: float = None) -> str:
    """Enrich raw description with keyword signals and amount buckets."""
    text = description.lower()

    # Append matched keywords to boost signal
    keyword_matches = []
    for category, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                keyword_matches.append(f"KEYWORD_{kw.replace(' ', '_').upper()}")

    # Amount bucket feature
    if amount is not None:
        if amount < 10:
            keyword_matches.append("AMOUNT_MICRO")
        elif amount < 50:
            keyword_matches.append("AMOUNT_SMALL")
        elif amount < 500:
            keyword_matches.append("AMOUNT_MEDIUM")
        elif amount < 2000:
            keyword_matches.append("AMOUNT_LARGE")
        else:
            keyword_matches.append("AMOUNT_XLARGE")

    return text + " " + " ".join(keyword_matches)


class ExpenseCategorizer:
    def __init__(self):
        self.model: Pipeline = None
        self.label_encoder = LabelEncoder()
        self.label_encoder.fit(CATEGORIES)
        self.feedback_count = 0
        self.training_samples = 0
        MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        FEEDBACK_PATH.parent.mkdir(parents=True, exist_ok=True)

    def _build_tfidf(self):
        return TfidfVectorizer(
            ngram_range=(1, 2),
            max_features=8000,
            sublinear_tf=True,
            analyzer="word",
            min_df=1,
        )

    def _build_pipeline(self):
        """Build pipeline for cross-validation scoring (uses plain LinearSVC)."""
        return Pipeline([
            ("tfidf", self._build_tfidf()),
            ("clf", LinearSVC(C=1.0, max_iter=2000, class_weight="balanced", dual="auto")),
        ])

    def load_or_train(self):
        if MODEL_PATH.exists():
            logger.info("Loading saved model...")
            self.model = joblib.load(MODEL_PATH)
        else:
            logger.info("No saved model found. Training from scratch...")
            self.train()

    def _load_training_data(self):
        """Load base training data + accumulated feedback."""
        texts, labels = [], []

        # Base training data
        if TRAINING_DATA_PATH.exists():
            with open(TRAINING_DATA_PATH) as f:
                base_data = json.load(f)
            for item in base_data:
                texts.append(build_enhanced_text(item["description"], item.get("amount")))
                labels.append(item["category"])

        # Feedback data
        if FEEDBACK_PATH.exists():
            with open(FEEDBACK_PATH) as f:
                for line in f:
                    if line.strip():
                        item = json.loads(line)
                        # Weight feedback 3x to emphasize corrections
                        for _ in range(3):
                            texts.append(build_enhanced_text(item["description"], item.get("amount")))
                            labels.append(item["category"])

        self.training_samples = len(texts)
        return texts, labels

    def train(self):
        texts, labels = self._load_training_data()
        if not texts:
            logger.warning("No training data found. Using keyword-only fallback.")
            return

        # Step 1: fit TF-IDF and base LinearSVC
        tfidf = self._build_tfidf()
        X = tfidf.fit_transform(texts)
        svc = LinearSVC(C=1.0, max_iter=2000, class_weight="balanced", dual="auto")
        svc.fit(X, labels)

        # Step 2: calibrate with cv='prefit' to avoid cross-validation issues
        # with classes that have few samples
        calibrated = CalibratedClassifierCV(svc, cv="prefit", method="sigmoid")
        calibrated.fit(X, labels)

        # Compose the final scoring pipeline (tfidf is already fitted)
        self.model = Pipeline([("tfidf", tfidf), ("clf", calibrated)])

        # Cross-validation for logging (uses plain LinearSVC to avoid cv restrictions)
        from collections import Counter
        min_class_count = min(Counter(labels).values())
        cv_folds = max(2, min(5, min_class_count))
        try:
            scores = cross_val_score(self._build_pipeline(), texts, labels, cv=cv_folds, scoring="accuracy")
            logger.info(
                f"Model trained. CV Accuracy: {scores.mean():.3f} ± {scores.std():.3f} "
                f"({self.training_samples} samples)"
            )
        except Exception as cv_err:
            logger.warning(f"Cross-validation skipped: {cv_err}")
            logger.info(f"Model trained on {self.training_samples} samples.")

        joblib.dump(self.model, MODEL_PATH)
        logger.info(f"Model saved to {MODEL_PATH}")

    def retrain(self):
        """Retrain model incorporating all feedback."""
        logger.info("Retraining model with feedback...")
        self.train()

    def predict(self, description: str, amount: float = None) -> dict:
        enhanced = build_enhanced_text(description, amount)

        if self.model is None:
            # Pure keyword fallback
            return self._keyword_fallback(description)

        proba = self.model.predict_proba([enhanced])[0]
        classes = self.model.classes_
        top_idx = np.argsort(proba)[::-1]

        best_category = classes[top_idx[0]]
        confidence = float(proba[top_idx[0]])

        alternatives = [
            {"category": classes[i], "confidence": round(float(proba[i]), 3)}
            for i in top_idx[1:4]
        ]

        return {
            "category": best_category,
            "confidence": round(confidence, 3),
            "alternatives": alternatives,
        }

    def _keyword_fallback(self, description: str) -> dict:
        """Fallback when model not trained yet."""
        scores = extract_keyword_features(description)
        best = max(scores, key=scores.get)
        category = best if scores[best] > 0 else "Other"
        return {"category": category, "confidence": 0.6, "alternatives": []}

    def add_feedback(self, description: str, correct_category: str):
        """Append correction to feedback file and optionally retrain."""
        entry = {"description": description, "category": correct_category}
        with open(FEEDBACK_PATH, "a") as f:
            f.write(json.dumps(entry) + "\n")

        self.feedback_count += 1

        # Auto-retrain every 50 feedback entries
        if self.feedback_count % 50 == 0:
            logger.info(f"Auto-retraining after {self.feedback_count} feedback entries...")
            self.retrain()
