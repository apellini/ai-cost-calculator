"""Unit tests for the pure-math engine components."""
import pytest

from app.engine.cost_calculator import (
    ModelPricing, SubTaskTokens,
    calc_sub_task_cost, calc_feature_cost, apply_volume_discount,
)
from app.engine.budget_optimizer import FeatureItem, optimize


# ── cost_calculator ───────────────────────────────────────────────────────────

def test_sub_task_tokens_effective():
    t = SubTaskTokens(
        system_prompt_tokens=1000,
        input_context_tokens=2000,
        output_tokens=500,
        interaction_rounds=2,
        worst_case_multiplier=1.5,
    )
    # effective_input = (1000+2000) * 2 * 1.5 = 9000
    assert t.effective_input == 9000
    # effective_output = 500 * 2 * 1.5 = 1500
    assert t.effective_output == 1500
    assert t.total == 10500


def test_calc_sub_task_cost_known_values():
    pricing = ModelPricing(model_id=1, slug="test", input_per_1m=10.0, output_per_1m=30.0)
    tokens = SubTaskTokens(
        system_prompt_tokens=0,
        input_context_tokens=1_000_000,
        output_tokens=1_000_000,
        interaction_rounds=1,
        worst_case_multiplier=1.0,
    )
    # 1M input @ $10 + 1M output @ $30 = $40
    assert calc_sub_task_cost(tokens, pricing) == pytest.approx(40.0)


def test_calc_feature_cost_aggregates():
    pricing = ModelPricing(model_id=1, slug="test", input_per_1m=1.0, output_per_1m=2.0)
    sub_tasks = [
        ("task-a", SubTaskTokens(500_000, 500_000, 500_000, 1, 1.0)),
        ("task-b", SubTaskTokens(500_000, 500_000, 500_000, 1, 1.0)),
    ]
    fc = calc_feature_cost(feature_id=1, feature_name="F", sub_tasks=sub_tasks, pricing=pricing)
    # Each task: input=1M, output=500k → cost = $1 + $1 = $2
    # Two tasks: $4 total
    assert fc.cost == pytest.approx(4.0)
    assert fc.input_tokens == 2_000_000
    assert fc.output_tokens == 1_000_000


def test_volume_discount():
    tiers = [
        {"min_tokens": 1_000_000_000, "discount_pct": 5},
        {"min_tokens": 5_000_000_000, "discount_pct": 10},
    ]
    assert apply_volume_discount(100.0, 500_000_000, tiers) == pytest.approx(100.0)
    assert apply_volume_discount(100.0, 1_000_000_000, tiers) == pytest.approx(95.0)
    assert apply_volume_discount(100.0, 5_000_000_000, tiers) == pytest.approx(90.0)


# ── budget_optimizer ──────────────────────────────────────────────────────────

def test_all_fit_in_budget():
    features = [
        FeatureItem(1, "A", cost=100.0, priority=1),
        FeatureItem(2, "B", cost=200.0, priority=2),
    ]
    result = optimize(features, budget=500.0)
    assert not result.is_over_budget
    assert set(result.included) == {1, 2}
    assert result.excluded == []


def test_optimizer_excludes_lowest_priority():
    features = [
        FeatureItem(1, "Must-have", cost=300.0, priority=1),
        FeatureItem(2, "Nice-to-have", cost=300.0, priority=9),
    ]
    result = optimize(features, budget=400.0)
    assert result.is_over_budget
    assert 1 in result.included
    assert 2 in result.excluded


def test_optimizer_empty():
    result = optimize([], budget=1000.0)
    assert result.included == []
    assert result.total_cost == 0.0


def test_optimizer_nothing_fits():
    features = [FeatureItem(1, "Expensive", cost=10_000.0, priority=1)]
    result = optimize(features, budget=100.0)
    assert result.is_over_budget
    assert result.excluded == [1]
