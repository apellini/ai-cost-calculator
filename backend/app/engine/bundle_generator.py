"""
Maps each feature's primary category to the best model for a given tier.

Tier strategy:
  economy  — highest task_fit score among models where output_per_1m <= threshold
  balanced — best cost/quality ratio: task_fit / output_per_1m, weighted
  premium  — highest task_fit score regardless of cost
"""
from dataclasses import dataclass

from app.engine.cost_calculator import FeatureCost, ModelPricing, SubTaskTokens, calc_feature_cost


# Per-tier output price ceiling ($/1M tokens) used for economy filtering
ECONOMY_MAX_OUTPUT_PRICE = 5.0
BALANCED_MAX_OUTPUT_PRICE = 25.0


@dataclass(frozen=True)
class ModelCandidate:
    model_id: int
    slug: str
    display_name: str
    input_per_1m: float
    output_per_1m: float
    batch_per_1m: float | None
    cached_input_per_1m: float | None
    volume_tiers: list
    task_fit: dict  # category -> score (0-100)


def _best_model_for_tier(
    category: str,
    candidates: list[ModelCandidate],
    tier: str,
) -> ModelCandidate:
    if not candidates:
        raise ValueError("No model candidates provided")

    def task_score(m: ModelCandidate) -> float:
        return float(m.task_fit.get(category, 50))

    if tier == "economy":
        eligible = [m for m in candidates if m.output_per_1m <= ECONOMY_MAX_OUTPUT_PRICE]
        pool = eligible or candidates  # fall back to all if none qualify
        # Pick cheapest model with acceptable quality (task_fit >= 50).
        # Minimising price guarantees economy is always the lowest-cost tier.
        acceptable = [m for m in pool if task_score(m) >= 50]
        return min(acceptable or pool, key=lambda m: m.output_per_1m)

    if tier == "balanced":
        # Score = task_fit / log(output_price + 1) — rewards quality, penalises cost logarithmically
        import math
        def balanced_score(m: ModelCandidate) -> float:
            return task_score(m) / math.log(m.output_per_1m + 2)
        eligible = [m for m in candidates if m.output_per_1m <= BALANCED_MAX_OUTPUT_PRICE]
        pool = eligible or candidates
        return max(pool, key=balanced_score)

    if tier == "premium":
        return max(candidates, key=task_score)

    raise ValueError(f"Unknown tier: {tier!r}")


def generate_bundle(
    features: list[dict],           # [{"id", "name", "category", "sub_tasks": [{"name", tokens}]}]
    candidates: list[ModelCandidate],
    tier: str,
    monthly_multiplier: int = 1000,  # scale single-session cost → monthly
) -> list[FeatureCost]:
    """
    For each feature, pick the best model for the tier and calculate cost.
    monthly_multiplier scales the per-session token cost to a monthly estimate.
    """
    results: list[FeatureCost] = []

    for feature in features:
        category = feature.get("category") or "qa_chatbot"
        model = _best_model_for_tier(category, candidates, tier)
        pricing = ModelPricing(
            model_id=model.model_id,
            slug=model.slug,
            input_per_1m=model.input_per_1m,
            output_per_1m=model.output_per_1m,
            batch_per_1m=model.batch_per_1m,
            cached_input_per_1m=model.cached_input_per_1m,
        )

        sub_tasks: list[tuple[str, SubTaskTokens]] = []
        for st in feature["sub_tasks"]:
            tokens = SubTaskTokens(
                system_prompt_tokens=st["system_prompt_tokens"],
                input_context_tokens=st["input_context_tokens"],
                output_tokens=st["output_tokens"],
                interaction_rounds=st["interaction_rounds"],
                worst_case_multiplier=st["worst_case_multiplier"],
            )
            sub_tasks.append((st["name"], tokens))

        # Scale to monthly
        scaled_sub_tasks = [
            (name, SubTaskTokens(
                system_prompt_tokens=t.system_prompt_tokens * monthly_multiplier,
                input_context_tokens=t.input_context_tokens * monthly_multiplier,
                output_tokens=t.output_tokens * monthly_multiplier,
                interaction_rounds=t.interaction_rounds,
                worst_case_multiplier=t.worst_case_multiplier,
            ))
            for name, t in sub_tasks
        ]

        fc = calc_feature_cost(
            feature_id=feature["id"],
            feature_name=feature["name"],
            sub_tasks=scaled_sub_tasks,
            pricing=pricing,
        )
        results.append(fc)

    return results
