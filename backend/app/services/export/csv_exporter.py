"""CSV export: one row per (tier, feature) with cost and model assignment."""
import csv
import io

from app.routers.analysis import AnalysisOut


def build_csv(project_name: str, analysis: AnalysisOut) -> str:
    """Return CSV string with header + one row per bundle-feature pair."""
    buf = io.StringIO()
    writer = csv.writer(buf)

    writer.writerow([
        "project", "tier", "feature_id", "model_slug",
        "cost_usd", "input_tokens", "output_tokens",
    ])

    for bundle in analysis.bundles:
        for fc in bundle.feature_costs:
            writer.writerow([
                project_name,
                bundle.tier,
                fc.feature_id,
                fc.model_slug,
                f"{fc.cost:.6f}",
                fc.input_tokens,
                fc.output_tokens,
            ])

    return buf.getvalue()
