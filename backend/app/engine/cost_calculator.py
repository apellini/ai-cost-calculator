"""
Pure-math cost calculator. No I/O, no DB — fully unit-testable.

Formula per sub-task:
    effective_tokens = (system_prompt + input_context + output) × rounds × multiplier
    input_tokens     = (system_prompt + input_context) × rounds × multiplier
    output_tokens    = output × rounds × multiplier
    cost             = (input_tokens / 1_000_000 × input_price)
                     + (output_tokens / 1_000_000 × output_price)

Feature cost = sum of all sub-task costs.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ModelPricing:
    model_id: int
    slug: str
    input_per_1m: float
    output_per_1m: float
    # Optional discounted prices (batch API / prompt cache)
    batch_per_1m: float | None = None
    cached_input_per_1m: float | None = None


@dataclass(frozen=True)
class SubTaskTokens:
    system_prompt_tokens: int
    input_context_tokens: int
    output_tokens: int
    interaction_rounds: int
    worst_case_multiplier: float

    @property
    def effective_input(self) -> int:
        return int(
            (self.system_prompt_tokens + self.input_context_tokens)
            * self.interaction_rounds
            * self.worst_case_multiplier
        )

    @property
    def effective_output(self) -> int:
        return int(
            self.output_tokens
            * self.interaction_rounds
            * self.worst_case_multiplier
        )

    @property
    def total(self) -> int:
        return self.effective_input + self.effective_output


@dataclass
class SubTaskCost:
    name: str
    tokens: SubTaskTokens
    model_id: int
    cost: float


@dataclass
class FeatureCost:
    feature_id: int
    feature_name: str
    model_id: int
    model_slug: str
    input_tokens: int
    output_tokens: int
    cost: float
    sub_task_costs: list[SubTaskCost] = field(default_factory=list)


def calc_sub_task_cost(tokens: SubTaskTokens, pricing: ModelPricing) -> float:
    return (
        tokens.effective_input / 1_000_000 * pricing.input_per_1m
        + tokens.effective_output / 1_000_000 * pricing.output_per_1m
    )


def calc_feature_cost(
    feature_id: int,
    feature_name: str,
    sub_tasks: list[tuple[str, SubTaskTokens]],
    pricing: ModelPricing,
) -> FeatureCost:
    """
    Calculate the total cost for a feature given a list of (name, SubTaskTokens)
    and the model pricing to apply.
    """
    sub_costs: list[SubTaskCost] = []
    total_input = total_output = 0

    for name, tokens in sub_tasks:
        cost = calc_sub_task_cost(tokens, pricing)
        sub_costs.append(SubTaskCost(name=name, tokens=tokens, model_id=pricing.model_id, cost=cost))
        total_input += tokens.effective_input
        total_output += tokens.effective_output

    total_cost = (
        total_input / 1_000_000 * pricing.input_per_1m
        + total_output / 1_000_000 * pricing.output_per_1m
    )

    return FeatureCost(
        feature_id=feature_id,
        feature_name=feature_name,
        model_id=pricing.model_id,
        model_slug=pricing.slug,
        input_tokens=total_input,
        output_tokens=total_output,
        cost=total_cost,
        sub_task_costs=sub_costs,
    )


def apply_volume_discount(cost: float, monthly_tokens: int, volume_tiers: list[dict]) -> float:
    """Apply the highest qualifying volume discount tier."""
    discount_pct = 0.0
    for tier in sorted(volume_tiers, key=lambda t: t["min_tokens"]):
        if monthly_tokens >= tier["min_tokens"]:
            discount_pct = tier["discount_pct"]
    return cost * (1 - discount_pct / 100)
