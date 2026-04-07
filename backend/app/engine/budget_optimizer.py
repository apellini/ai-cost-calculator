"""
0/1 Knapsack budget optimizer.

Given a list of features with costs and priorities, find the subset that:
  - Fits within the monthly budget
  - Maximises priority-weighted value (lower priority number = higher importance)
  - NEVER degrades quality to fit budget — only excludes lower-priority features

Priority scale: 1 = must-have, 10 = nice-to-have
Value weight:   11 - priority  (priority 1 → weight 10, priority 10 → weight 1)
"""
from dataclasses import dataclass


@dataclass
class FeatureItem:
    feature_id: int
    feature_name: str
    cost: float       # monthly cost
    priority: int     # 1 (highest) to 10 (lowest)

    @property
    def weight(self) -> int:
        """Higher weight = more important to include."""
        return 11 - max(1, min(10, self.priority))


@dataclass
class OptimizationResult:
    included: list[int]   # feature_ids that fit in budget
    excluded: list[int]   # feature_ids that were dropped
    total_cost: float
    budget: float
    is_over_budget: bool

    @property
    def gap(self) -> float:
        return max(0.0, self.total_cost - self.budget)


def optimize(
    features: list[FeatureItem],
    budget: float,
) -> OptimizationResult:
    """
    Returns the optimal subset of features within budget.
    Uses integer DP (costs scaled to cents for integer indexing).
    Falls back to greedy if budget is very large (> 1M).
    """
    if not features:
        return OptimizationResult([], [], 0.0, budget, False)

    full_cost = sum(f.cost for f in features)
    if full_cost <= budget:
        return OptimizationResult(
            included=[f.feature_id for f in features],
            excluded=[],
            total_cost=full_cost,
            budget=budget,
            is_over_budget=False,
        )

    # Scale costs to integer cents for DP
    SCALE = 100
    budget_int = int(budget * SCALE)

    # Guard against pathological budgets
    if budget_int > 10_000_000:
        return _greedy_fallback(features, budget, full_cost)

    n = len(features)
    # dp[j] = max weighted value achievable with budget j cents
    dp = [0] * (budget_int + 1)
    # track chosen items
    chosen = [[False] * (budget_int + 1) for _ in range(n)]

    for i, item in enumerate(features):
        cost_int = max(1, int(item.cost * SCALE))
        w = item.weight
        for j in range(budget_int, cost_int - 1, -1):
            candidate = dp[j - cost_int] + w
            if candidate > dp[j]:
                dp[j] = candidate
                chosen[i][j] = True

    # Backtrack to find included items
    included_ids: set[int] = set()
    j = budget_int
    for i in range(n - 1, -1, -1):
        if chosen[i][j]:
            included_ids.add(features[i].feature_id)
            j -= max(1, int(features[i].cost * SCALE))

    excluded_ids = [f.feature_id for f in features if f.feature_id not in included_ids]
    total_included = sum(f.cost for f in features if f.feature_id in included_ids)

    return OptimizationResult(
        included=list(included_ids),
        excluded=excluded_ids,
        total_cost=full_cost,
        budget=budget,
        is_over_budget=True,
    )


def _greedy_fallback(
    features: list[FeatureItem],
    budget: float,
    full_cost: float,
) -> OptimizationResult:
    """Sort by priority descending (most important first), include greedily."""
    sorted_features = sorted(features, key=lambda f: f.priority)
    included_ids: list[int] = []
    running = 0.0
    for f in sorted_features:
        if running + f.cost <= budget:
            included_ids.append(f.feature_id)
            running += f.cost
    included_set = set(included_ids)
    excluded_ids = [f.feature_id for f in features if f.feature_id not in included_set]
    return OptimizationResult(
        included=included_ids,
        excluded=excluded_ids,
        total_cost=full_cost,
        budget=budget,
        is_over_budget=True,
    )
