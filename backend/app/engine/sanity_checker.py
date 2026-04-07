"""
Validates LLM-estimated token counts against category floor/ceiling bounds.
These bounds are guardrails only — actual values come from the LLM decomposition.
"""
from dataclasses import dataclass

from app.engine.cost_calculator import SubTaskTokens


@dataclass
class CategoryBounds:
    slug: str
    min_input_tokens: int
    max_input_tokens: int
    min_output_tokens: int
    max_output_tokens: int


@dataclass
class SanityWarning:
    sub_task_name: str
    field: str
    value: int
    bound: int
    kind: str  # "below_min" | "above_max"

    def __str__(self) -> str:
        direction = "below minimum" if self.kind == "below_min" else "above maximum"
        return (
            f"Sub-task '{self.sub_task_name}': {self.field}={self.value:,} is "
            f"{direction} ({self.bound:,}) for its category"
        )


def check_sub_task(
    name: str,
    tokens: SubTaskTokens,
    bounds: CategoryBounds,
) -> list[SanityWarning]:
    warnings: list[SanityWarning] = []

    checks = [
        ("input_context_tokens", tokens.input_context_tokens, bounds.min_input_tokens, bounds.max_input_tokens),
        ("output_tokens", tokens.output_tokens, bounds.min_output_tokens, bounds.max_output_tokens),
    ]
    for field, value, min_b, max_b in checks:
        if value < min_b:
            warnings.append(SanityWarning(name, field, value, min_b, "below_min"))
        elif value > max_b:
            warnings.append(SanityWarning(name, field, value, max_b, "above_max"))

    return warnings
