import pytest
from cost_tracker import CostTracker
from models import ImageProvider


def test_cost_tracker_initial():
    tracker = CostTracker()
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 0
    assert cost.minimax_calls == 0
    assert cost.total_cost == 0.0


def test_record_gemini_call():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 1
    assert cost.total_cost == CostTracker.GEMINI_COST_PER_CALL


def test_record_minimax_call():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.MINIMAX)
    cost = tracker.get_cost_info()
    assert cost.minimax_calls == 1
    assert cost.total_cost == CostTracker.MINIMAX_COST_PER_CALL


def test_record_multiple_calls():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    tracker.record_call(ImageProvider.GEMINI)
    tracker.record_call(ImageProvider.MINIMAX)
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 2
    assert cost.minimax_calls == 1
    assert cost.total_cost == 2 * CostTracker.GEMINI_COST_PER_CALL + CostTracker.MINIMAX_COST_PER_CALL


def test_reset():
    tracker = CostTracker()
    tracker.record_call(ImageProvider.GEMINI)
    tracker.reset()
    cost = tracker.get_cost_info()
    assert cost.gemini_calls == 0
    assert cost.total_cost == 0.0
