"""
Timeline estimator: converts sub-task token complexity into dev-day estimates.

With AI  : 2 parallel dev tracks; dev time driven by token/interaction complexity.
Without AI: 1 serial dev track; 5× slower than AI-assisted pace.

Critical path = the sequence of features on the longest dependency chain
(computed via topological sort on the schedule graph).
"""
import math
from dataclasses import dataclass, field
from datetime import date, timedelta

# Tokens a developer produces per hour when assisted by AI (empirical estimate)
_AI_TOKENS_PER_HOUR = 600
# Multiplier: manual coding is ~5× slower than AI-assisted
_MANUAL_SLOWDOWN = 5
# Working hours per day
_HOURS_PER_DAY = 8
# Number of parallel AI-assisted dev tracks
_AI_PARALLEL_TRACKS = 2
# Number of parallel manual dev tracks
_MANUAL_PARALLEL_TRACKS = 1
# Minimum 0.5 day per feature
_MIN_DAYS = 0.5


@dataclass
class FeatureTimeline:
    feature_id: int
    feature_name: str
    with_ai_days: float
    without_ai_days: float
    start_date: date
    end_date: date
    depends_on: list[int] = field(default_factory=list)
    critical_path: bool = False


@dataclass
class TimelineResult:
    features: list[FeatureTimeline]
    total_with_ai_days: int
    total_without_ai_days: int
    start_date: date
    end_date: date


def _estimate_days(sub_tasks: list) -> float:
    """Estimate AI-assisted dev days for a feature given its sub-tasks."""
    if not sub_tasks:
        return 1.0

    total_effort = 0.0
    for st in sub_tasks:
        effective_output = (
            st.output_tokens
            * st.interaction_rounds
            * float(st.worst_case_multiplier)
        )
        hours = effective_output / _AI_TOKENS_PER_HOUR
        total_effort += hours

    days = total_effort / _HOURS_PER_DAY
    return max(_MIN_DAYS, round(days * 2) / 2)  # round to nearest 0.5


def _schedule(
    features_sorted: list,          # Feature ORM objects with .sub_tasks loaded
    parallel_tracks: int,
    ai_mode: bool,
    project_start: date,
) -> list[tuple[date, date]]:
    """
    Greedy earliest-slot scheduling across `parallel_tracks` parallel tracks.
    Returns list of (start, end) dates aligned to `features_sorted` order.
    """
    track_ends: list[date] = [project_start] * parallel_tracks
    result: list[tuple[date, date]] = []

    for feat in features_sorted:
        days = _estimate_days(feat.sub_tasks)
        if not ai_mode:
            days = days * _MANUAL_SLOWDOWN
        days_int = math.ceil(days)

        # Pick the track that ends earliest
        earliest_idx = min(range(parallel_tracks), key=lambda i: track_ends[i])
        start = track_ends[earliest_idx]
        end = start + timedelta(days=days_int)
        result.append((start, end))
        track_ends[earliest_idx] = end

    return result


def compute_timeline(features: list, project_start: date | None = None) -> TimelineResult:
    """
    Main entry point.

    `features` must be Feature ORM objects with `.sub_tasks` eagerly loaded,
    sorted in desired scheduling order (priority ASC, order ASC).
    """
    if project_start is None:
        project_start = date.today() + timedelta(days=7)

    if not features:
        return TimelineResult(
            features=[],
            total_with_ai_days=0,
            total_without_ai_days=0,
            start_date=project_start,
            end_date=project_start,
        )

    ai_schedule = _schedule(features, _AI_PARALLEL_TRACKS, True, project_start)
    manual_schedule = _schedule(features, _MANUAL_PARALLEL_TRACKS, False, project_start)

    # Compute overall span (max end date)
    ai_end = max(end for _, end in ai_schedule)
    manual_end = max(end for _, end in manual_schedule)

    total_with_ai = (ai_end - project_start).days
    total_without_ai = (manual_end - project_start).days

    # Critical path: features on the longest dependency chain.
    # Since we have no explicit feature deps, approximate as: features whose
    # end date equals the overall project end (i.e., they're on the critical track).
    feature_timelines: list[FeatureTimeline] = []
    for i, feat in enumerate(features):
        ai_start, ai_end_f = ai_schedule[i]
        with_ai_days_f = _estimate_days(feat.sub_tasks)
        without_ai_days_f = with_ai_days_f * _MANUAL_SLOWDOWN

        # Mark as critical if its end aligns with the overall project end
        is_critical = ai_end_f == ai_end

        feature_timelines.append(FeatureTimeline(
            feature_id=feat.id,
            feature_name=feat.name,
            with_ai_days=with_ai_days_f,
            without_ai_days=round(without_ai_days_f),
            start_date=ai_start,
            end_date=ai_end_f,
            depends_on=[],  # no explicit dep graph yet
            critical_path=is_critical,
        ))

    return TimelineResult(
        features=feature_timelines,
        total_with_ai_days=total_with_ai,
        total_without_ai_days=total_without_ai,
        start_date=project_start,
        end_date=ai_end,
    )
