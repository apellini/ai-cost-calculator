"""PDF export: Jinja2 HTML template rendered to PDF via WeasyPrint."""
from datetime import datetime
from pathlib import Path

from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML

from app.routers.analysis import AnalysisOut

_TEMPLATE_DIR = Path(__file__).parent.parent.parent / "templates"
_env = Environment(loader=FileSystemLoader(str(_TEMPLATE_DIR)))


def build_pdf(
    project_name: str,
    analysis: AnalysisOut,
    feature_names: dict[int, str],
) -> bytes:
    """Render analysis to PDF bytes."""
    template = _env.get_template("analysis_report.html")
    html_str = template.render(
        project_name=project_name,
        scenario_id=analysis.scenario_id,
        generated_at=datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC"),
        bundles=analysis.bundles,
        feature_names=feature_names,
        warnings=analysis.warnings,
    )
    return HTML(string=html_str).write_pdf()
