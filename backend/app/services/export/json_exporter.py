"""JSON export: serializes full analysis result to a structured dict."""
import json
from datetime import datetime

from app.routers.analysis import AnalysisOut  # reuse existing schema


def build_json(project_name: str, analysis: AnalysisOut) -> str:
    """Return pretty-printed JSON of the analysis result."""
    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "project": project_name,
        "scenario_id": analysis.scenario_id,
        "status": analysis.status,
        "elapsed_seconds": analysis.elapsed_seconds,
        "warnings": analysis.warnings,
        "bundles": [
            {
                "tier": b.tier,
                "total_cost": b.total_cost,
                "feature_costs": [
                    {
                        "feature_id": fc.feature_id,
                        "model_slug": fc.model_slug,
                        "cost": fc.cost,
                        "input_tokens": fc.input_tokens,
                        "output_tokens": fc.output_tokens,
                    }
                    for fc in b.feature_costs
                ],
            }
            for b in analysis.bundles
        ],
    }
    return json.dumps(payload, indent=2)
