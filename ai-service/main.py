"""
main.py — FastAPI AI Microservice for Expense Tracker
Provides expense categorization, spending predictions, and insights.
"""

import os
import logging
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Security, Depends
from fastapi.security.api_key import APIKeyHeader
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from models.categorizer import ExpenseCategorizer
from models.predictor import SpendingPredictor

# --- Logging ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("ai-service")

# --- API Key Security ---
_raw_key = os.getenv("AI_SERVICE_KEY")
if not _raw_key:
    # Fail fast in production; allow default only in development
    if os.getenv("NODE_ENV") == "production" or os.getenv("ENV") == "production":
        raise RuntimeError("AI_SERVICE_KEY environment variable must be set in production.")
    logger.warning("AI_SERVICE_KEY not set — using default 'internal-key' (development only).")
    _raw_key = "internal-key"
API_KEY = _raw_key
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def verify_api_key(key: str = Security(api_key_header)):
    if key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid or missing API key.")
    return key


# --- Model singletons (loaded at startup) ---
categorizer = ExpenseCategorizer()
predictor = SpendingPredictor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Loading AI models...")
    categorizer.load_or_train()
    logger.info("AI models ready.")
    yield
    logger.info("Shutting down AI service.")


# --- FastAPI App ---
app = FastAPI(
    title="Expense Tracker AI Service",
    description="TF-IDF + LinearSVC expense categorization and spending predictions.",
    version="1.0.0",
    lifespan=lifespan,
)

# Restrict CORS to the configured client origin; default to localhost for local dev
_allowed_origins = os.getenv("CLIENT_URL", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Pydantic Schemas ---

class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount: Optional[float] = Field(None, ge=0)


class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    alternatives: List[dict]


class FeedbackRequest(BaseModel):
    description: str = Field(..., min_length=1)
    correct: str
    predicted: Optional[str] = None
    amount: Optional[float] = None


class PredictRequest(BaseModel):
    historicalData: List[float] = Field(..., min_length=1)


class InsightsRequest(BaseModel):
    currentMonth: List[dict] = []
    lastMonth: List[dict] = []
    historicalData: List[float] = []


class RetrainResponse(BaseModel):
    message: str
    training_samples: int


# --- Routes ---

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": categorizer.model is not None,
        "training_samples": categorizer.training_samples,
        "feedback_count": categorizer.feedback_count,
    }


@app.post("/categorize", response_model=CategorizeResponse, dependencies=[Depends(verify_api_key)])
def categorize(req: CategorizeRequest):
    """Categorize an expense description using TF-IDF + LinearSVC."""
    try:
        result = categorizer.predict(req.description, req.amount)
        return result
    except Exception as e:
        logger.error(f"Categorization error: {e}")
        raise HTTPException(status_code=500, detail="Categorization failed.")


@app.post("/feedback", dependencies=[Depends(verify_api_key)])
def feedback(req: FeedbackRequest):
    """Submit a user correction to improve the model."""
    try:
        categorizer.add_feedback(req.description, req.correct)
        return {
            "message": "Feedback recorded.",
            "feedback_count": categorizer.feedback_count,
        }
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail="Failed to record feedback.")


@app.post("/predict", dependencies=[Depends(verify_api_key)])
def predict(req: PredictRequest):
    """Predict next month's spending using Holt's exponential smoothing."""
    try:
        result = predictor.predict_next_month(req.historicalData)
        return result
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed.")


@app.post("/insights", dependencies=[Depends(verify_api_key)])
def insights(req: InsightsRequest):
    """Generate spending insights from category aggregates."""
    try:
        generated = []

        current_map = {d["_id"]: d["total"] for d in req.currentMonth}
        last_map = {d["_id"]: d["total"] for d in req.lastMonth}

        for category, curr in current_map.items():
            prev = last_map.get(category)
            if prev and prev > 0:
                change = ((curr - prev) / prev) * 100
                if change > 20:
                    generated.append({
                        "type": "warning",
                        "category": category,
                        "message": f"Your {category} spending jumped {change:.0f}% vs last month.",
                    })
                elif change < -20:
                    generated.append({
                        "type": "success",
                        "category": category,
                        "message": f"Great! You reduced {category} spending by {abs(change):.0f}%.",
                    })

        # Add a prediction-based insight
        if req.historicalData:
            prediction = predictor.predict_next_month(req.historicalData)
            generated.append({
                "type": "prediction",
                "message": prediction.get("message", ""),
                "predicted": prediction.get("predicted", 0),
                "trend": prediction.get("trend", "stable"),
            })

        return {"insights": generated}
    except Exception as e:
        logger.error(f"Insights error: {e}")
        raise HTTPException(status_code=500, detail="Insights generation failed.")


@app.post("/retrain", response_model=RetrainResponse, dependencies=[Depends(verify_api_key)])
def retrain():
    """Trigger model retraining with all accumulated feedback."""
    try:
        categorizer.retrain()
        return {
            "message": "Model retrained successfully.",
            "training_samples": categorizer.training_samples,
        }
    except Exception as e:
        logger.error(f"Retrain error: {e}")
        raise HTTPException(status_code=500, detail="Retraining failed.")
