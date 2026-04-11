# Import all models here so Alembic and the app can discover them
from app.models.provider import LLMProvider, LLMModel, ModelBenchmark  # noqa: F401
from app.models.project import TaskCategory, Project, Feature, SubTask  # noqa: F401
from app.models.bundle import Bundle, BundleFeatureCost, Scenario, ShareLink, Snapshot  # noqa: F401
from app.models.notification import Notification  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.invite_token import InviteToken  # noqa: F401
from app.models.pricing_source import PricingSource, ModelPricingSource  # noqa: F401

__all__ = [
    "LLMProvider",
    "LLMModel",
    "ModelBenchmark",
    "PricingSource",
    "ModelPricingSource",
    "TaskCategory",
    "Project",
    "Feature",
    "SubTask",
    "Bundle",
    "BundleFeatureCost",
    "Scenario",
    "Snapshot",
    "ShareLink",
    "Notification",
    "User",
    "InviteToken",
]
