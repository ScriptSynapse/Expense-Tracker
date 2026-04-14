"""
models/predictor.py — Simple time-series spending predictor
Uses exponential smoothing + linear trend for next-month forecast.
"""

import numpy as np
import logging

logger = logging.getLogger(__name__)


class SpendingPredictor:
    """
    Lightweight forecaster using Holt's double exponential smoothing.
    Works with 2–12 data points (months of history).
    Falls back to simple average for fewer data points.
    """

    def __init__(self, alpha: float = 0.4, beta: float = 0.2):
        self.alpha = alpha  # Level smoothing
        self.beta = beta    # Trend smoothing

    def predict_next_month(self, historical: list) -> dict:
        if not historical or all(v == 0 for v in historical):
            return {"predicted": 0.0, "trend": "stable", "confidence": "low", "message": "Not enough data to predict."}

        data = [float(v) for v in historical]

        if len(data) < 2:
            predicted = data[0]
            trend_pct = 0.0
        elif len(data) == 2:
            predicted = (data[0] + data[1]) / 2
            trend_pct = ((data[1] - data[0]) / data[0] * 100) if data[0] != 0 else 0
        else:
            predicted, trend_pct = self._holt_forecast(data)

        trend_label = self._classify_trend(trend_pct)
        confidence = "high" if len(data) >= 6 else "medium" if len(data) >= 3 else "low"

        avg = np.mean(data)
        message = self._build_message(predicted, avg, trend_pct, trend_label)

        return {
            "predicted": round(max(0.0, predicted), 2),
            "trend": trend_label,
            "trendPercent": round(trend_pct, 1),
            "confidence": confidence,
            "historicalAverage": round(avg, 2),
            "message": message,
        }

    def _holt_forecast(self, data: list) -> tuple:
        """Holt's double exponential smoothing."""
        level = data[0]
        trend = data[1] - data[0]

        for i in range(1, len(data)):
            prev_level = level
            level = self.alpha * data[i] + (1 - self.alpha) * (level + trend)
            trend = self.beta * (level - prev_level) + (1 - self.beta) * trend

        forecast = level + trend
        avg = np.mean(data)
        trend_pct = ((forecast - avg) / avg * 100) if avg != 0 else 0
        return forecast, trend_pct

    def _classify_trend(self, trend_pct: float) -> str:
        if trend_pct > 10:
            return "increasing"
        elif trend_pct < -10:
            return "decreasing"
        else:
            return "stable"

    def _build_message(self, predicted: float, avg: float, trend_pct: float, trend: str) -> str:
        if trend == "increasing":
            return f"Your spending is trending up. Predicted next month: ${predicted:.2f} ({trend_pct:+.0f}% vs avg)."
        elif trend == "decreasing":
            return f"Your spending is trending down. Predicted next month: ${predicted:.2f} ({trend_pct:+.0f}% vs avg)."
        else:
            return f"Your spending looks stable. Predicted next month: ${predicted:.2f}."
