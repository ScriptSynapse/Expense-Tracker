"""
tests/test_categorizer.py — Unit tests for AI categorization
"""

import pytest
import sys
sys.path.insert(0, '..')

from models.categorizer import ExpenseCategorizer, build_enhanced_text
from models.predictor import SpendingPredictor


class TestCategorizer:
    def setup_method(self):
        self.cat = ExpenseCategorizer()
        self.cat.load_or_train()

    def test_food_categorization(self):
        result = self.cat.predict("Zomato dinner biryani", 350)
        assert result["category"] == "Food & Dining"
        assert result["confidence"] > 0.5

    def test_transport_categorization(self):
        result = self.cat.predict("Uber ride to office", 250)
        assert result["category"] == "Transport"

    def test_shopping_categorization(self):
        result = self.cat.predict("Amazon order earphones", 1800)
        assert result["category"] == "Shopping"

    def test_entertainment_categorization(self):
        result = self.cat.predict("Netflix subscription monthly", 649)
        assert result["category"] == "Entertainment"

    def test_bills_categorization(self):
        result = self.cat.predict("Electricity bill payment", 2200)
        assert result["category"] == "Bills & Utilities"

    def test_confidence_range(self):
        result = self.cat.predict("Lunch at restaurant", 200)
        assert 0.0 <= result["confidence"] <= 1.0

    def test_alternatives_returned(self):
        result = self.cat.predict("Monthly payment", 500)
        assert "alternatives" in result
        assert isinstance(result["alternatives"], list)

    def test_feedback_recording(self):
        initial = self.cat.feedback_count
        self.cat.add_feedback("some expense", "Other")
        assert self.cat.feedback_count == initial + 1

    def test_amount_only_description(self):
        result = self.cat.predict("250", 250)
        assert "category" in result

    def test_enhanced_text_contains_keywords(self):
        text = build_enhanced_text("Uber ride", 250)
        assert "KEYWORD_UBER" in text
        assert "AMOUNT_MEDIUM" in text


class TestPredictor:
    def setup_method(self):
        self.pred = SpendingPredictor()

    def test_stable_prediction(self):
        data = [1000, 1000, 1000, 1000, 1000]
        result = self.pred.predict_next_month(data)
        assert result["trend"] == "stable"
        assert 800 < result["predicted"] < 1200

    def test_increasing_trend(self):
        data = [1000, 1200, 1400, 1600, 1800, 2000]
        result = self.pred.predict_next_month(data)
        assert result["trend"] == "increasing"
        assert result["predicted"] > 1500

    def test_decreasing_trend(self):
        data = [2000, 1800, 1600, 1400, 1200]
        result = self.pred.predict_next_month(data)
        assert result["trend"] in ("decreasing", "stable")

    def test_empty_data(self):
        result = self.pred.predict_next_month([])
        assert result["predicted"] == 0.0
        assert result["confidence"] == "low"

    def test_single_data_point(self):
        result = self.pred.predict_next_month([500])
        assert result["predicted"] >= 0

    def test_confidence_levels(self):
        assert self.pred.predict_next_month([1000, 2000])["confidence"] == "low"
        assert self.pred.predict_next_month([1000] * 4)["confidence"] == "medium"
        assert self.pred.predict_next_month([1000] * 7)["confidence"] == "high"
