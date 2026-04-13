"""
main.py — FastAPI AI microservice for expense categorization and insights
"""

import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import uvicorn

from models.categorizer import ExpenseCategorizer
from models.predictor import SpendingPredictor

# --- Logging ---
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# --- Global model instances ---
categorizer: Optional[ExpenseCategorizer] = None
predictor: Optional[SpendingPredictor] = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load ML models on startup, release on shutdown."""
    global categorizer, predictor
    logger.info("Loading ML models...")
    categorizer = ExpenseCategorizer()
    categorizer.load_or_train()
    predictor = SpendingPredictor()
    logger.info("Models loaded successfully.")
    yield
    logger.info("Shutting down AI service.")

app = FastAPI(
    title="Expense Tracker AI Service",
    description="NLP-powered expense categorization and spending insights",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- API Key auth ---
API_KEY = os.getenv("AI_SERVICE_KEY", "internal-key")

def verify_api_key(x_api_key: str = Header(default=None)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key

# --- Pydantic Models ---
class CategorizeRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount: Optional[float] = Field(None, ge=0)

class CategorizeResponse(BaseModel):
    category: str
    confidence: float
    alternatives: List[dict]

class FeedbackRequest(BaseModel):
    description: str
    amount: Optional[float] = None
    predicted: Optional[str] = None
    correct: str

class InsightsRequest(BaseModel):
    currentMonth: List[dict]
    lastMonth: List[dict]

class PredictRequest(BaseModel):
    historicalData: List[float]

# --- Endpoints ---

@app.get("/health")
async def health():
    return {"status": "ok", "models_loaded": categorizer is not None}

@app.post("/categorize", response_model=CategorizeResponse)
async def categorize(req: CategorizeRequest, _=Depends(verify_api_key)):
    """Categorize expense description using trained NLP model."""
    if not categorizer:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        result = categorizer.predict(req.description, req.amount)
        return result
    except Exception as e:
        logger.error(f"Categorization error: {e}")
        raise HTTPException(status_code=500, detail="Categorization failed")

@app.post("/feedback")
async def feedback(req: FeedbackRequest, _=Depends(verify_api_key)):
    """Accept user correction and append to retraining dataset."""
    if not categorizer:
        raise HTTPException(status_code=503, detail="Model not loaded")
    try:
        categorizer.add_feedback(req.description, req.correct)
        return {"status": "feedback recorded", "will_retrain": categorizer.feedback_count % 50 == 0}
    except Exception as e:
        logger.error(f"Feedback error: {e}")
        raise HTTPException(status_code=500, detail="Feedback recording failed")

@app.post("/predict")
async def predict(req: PredictRequest, _=Depends(verify_api_key)):
    """Predict next month's total spending using time series."""
    if not predictor:
        raise HTTPException(status_code=503, detail="Predictor not loaded")
    try:
        prediction = predictor.predict_next_month(req.historicalData)
        return prediction
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")

@app.post("/insights")
async def insights(req: InsightsRequest, _=Depends(verify_api_key)):
    """Generate NLP-driven spending insights."""
    try:
        insights_list = generate_insights(req.currentMonth, req.lastMonth)
        return {"insights": insights_list}
    except Exception as e:
        logger.error(f"Insights error: {e}")
        return {"insights": []}

@app.post("/retrain")
async def retrain(_=Depends(verify_api_key)):
    """Manually trigger model retraining with accumulated feedback."""
    if not categorizer:
        raise HTTPException(status_code=503, detail="Model not loaded")
    categorizer.retrain()
    return {"status": "retrained", "samples": categorizer.training_samples}

def generate_insights(current: list, last: list) -> list:
    """Build human-readable insights from month-over-month data."""
    insights = []
    current_map = {item["_id"]: item["total"] for item in current}
    last_map = {item["_id"]: item["total"] for item in last}

    tips = {
        "Food & Dining": "Try meal prepping to reduce dining costs.",
        "Transport": "Consider public transit or carpooling to save on transport.",
        "Shopping": "Use a 24-hour rule before non-essential purchases.",
        "Entertainment": "Look for free or discounted local events.",
        "Bills & Utilities": "Review subscriptions — cancel unused ones.",
    }

    for category, curr in current_map.items():
        prev = last_map.get(category, 0)
        if prev > 0:
            change_pct = ((curr - prev) / prev) * 100
            if change_pct >= 20:
                insight = {
                    "type": "warning",
                    "category": category,
                    "change": round(change_pct, 1),
                    "message": f"You spent {round(change_pct)}% more on {category} this month (${curr:.2f} vs ${prev:.2f}).",
                    "tip": tips.get(category, "Review this category's spending for savings opportunities."),
                }
                insights.append(insight)
            elif change_pct <= -20:
                insights.append({
                    "type": "success",
                    "category": category,
                    "change": round(change_pct, 1),
                    "message": f"Great job! You saved {abs(round(change_pct))}% on {category} this month.",
                    "tip": None,
                })

    return insights[:5]

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
