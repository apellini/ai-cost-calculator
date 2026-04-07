"""
Seed database with initial data.

Usage:
    python -m app.seed.seed_data --mode=fictional   # fictional dev data (default)
    python -m app.seed.seed_data --mode=real        # real provider data (future)
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine, Base
from app.models import (
    LLMProvider, LLMModel, ModelBenchmark,
    TaskCategory, Project, Feature, SubTask, User,
)

DATA_DIR = Path(__file__).parent / "data"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


async def create_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_providers_and_models(session: AsyncSession) -> dict[str, LLMModel]:
    providers_data = json.loads((DATA_DIR / "fictional_providers.json").read_text())
    models_data = json.loads((DATA_DIR / "fictional_models.json").read_text())
    benchmarks_data = {b["slug"]: b for b in json.loads((DATA_DIR / "fictional_benchmarks.json").read_text())}

    provider_map: dict[str, LLMProvider] = {}
    for p in providers_data:
        existing = await session.scalar(select(LLMProvider).where(LLMProvider.name == p["name"]))
        if existing:
            provider_map[p["name"]] = existing
            continue
        provider = LLMProvider(**p)
        session.add(provider)
        await session.flush()
        provider_map[p["name"]] = provider

    model_map: dict[str, LLMModel] = {}
    for m in models_data:
        existing = await session.scalar(select(LLMModel).where(LLMModel.slug == m["slug"]))
        if existing:
            model_map[m["slug"]] = existing
            continue
        provider = provider_map[m["provider"]]
        model = LLMModel(
            provider_id=provider.id,
            slug=m["slug"],
            display_name=m["display_name"],
            context_window=m.get("context_window"),
            input_per_1m=m["input_per_1m"],
            output_per_1m=m["output_per_1m"],
            batch_per_1m=m.get("batch_per_1m"),
            cached_input_per_1m=m.get("cached_input_per_1m"),
            volume_tiers=m.get("volume_tiers", []),
            task_fit=m.get("task_fit", {}),
        )
        session.add(model)
        await session.flush()
        model_map[m["slug"]] = model

        bench = benchmarks_data.get(m["slug"])
        if bench:
            bm = ModelBenchmark(
                model_id=model.id,
                mmlu=bench.get("mmlu"),
                human_eval=bench.get("human_eval"),
                math=bench.get("math"),
                reasoning=bench.get("reasoning"),
                speed_tps=bench.get("speed_tps"),
            )
            session.add(bm)

    return model_map


async def seed_task_categories(session: AsyncSession) -> None:
    categories_data = json.loads((DATA_DIR / "task_categories.json").read_text())
    for c in categories_data:
        existing = await session.scalar(select(TaskCategory).where(TaskCategory.slug == c["slug"]))
        if existing:
            continue
        session.add(TaskCategory(**c))


async def seed_admin_user(session: AsyncSession) -> User:
    existing = await session.scalar(select(User).where(User.email == "admin@example.com"))
    if existing:
        return existing
    user = User(
        email="admin@example.com",
        name="Admin User",
        hashed_password=hash_password("admin1234"),
        role="admin",
    )
    session.add(user)
    await session.flush()
    return user


async def seed_demo_project(session: AsyncSession, owner: User) -> None:
    existing = await session.scalar(select(Project).where(Project.name == "TaskFlow - AI-Powered Project Manager"))
    if existing:
        return

    demo_data = json.loads((DATA_DIR / "fictional_demo_project.json").read_text())
    project = Project(
        owner_id=owner.id,
        name=demo_data["name"],
        description=demo_data["description"],
        budget_monthly=demo_data["budget_monthly"],
        status="ready",
    )
    session.add(project)
    await session.flush()

    for i, f in enumerate(demo_data["features"]):
        feature = Feature(
            project_id=project.id,
            name=f["name"],
            description=f["description"],
            category=f["category"],
            priority=f["priority"],
            order=i,
        )
        session.add(feature)
        await session.flush()

        total_input = 0
        total_output = 0
        for j, st in enumerate(f.get("sub_tasks", [])):
            sub = SubTask(
                feature_id=feature.id,
                name=st["name"],
                category=st["category"],
                reasoning=st.get("reasoning"),
                system_prompt_tokens=st["system_prompt_tokens"],
                input_context_tokens=st["input_context_tokens"],
                output_tokens=st["output_tokens"],
                interaction_rounds=st["interaction_rounds"],
                worst_case_multiplier=st["worst_case_multiplier"],
                order=j,
            )
            session.add(sub)
            rounds = st["interaction_rounds"]
            mult = st["worst_case_multiplier"]
            total_input += int((st["system_prompt_tokens"] + st["input_context_tokens"]) * rounds * mult)
            total_output += int(st["output_tokens"] * rounds * mult)

        feature.total_input_tokens = total_input
        feature.total_output_tokens = total_output


async def seed_real_providers_and_models(session: AsyncSession) -> None:
    providers_data = json.loads((DATA_DIR / "real_providers.json").read_text())
    models_data = json.loads((DATA_DIR / "real_models.json").read_text())
    benchmarks_data = {b["slug"]: b for b in json.loads((DATA_DIR / "real_benchmarks.json").read_text())}

    provider_map: dict[str, LLMProvider] = {}
    for p in providers_data:
        existing = await session.scalar(select(LLMProvider).where(LLMProvider.name == p["name"]))
        if existing:
            provider_map[p["name"]] = existing
            continue
        provider = LLMProvider(**p)
        session.add(provider)
        await session.flush()
        provider_map[p["name"]] = provider

    for m in models_data:
        existing = await session.scalar(select(LLMModel).where(LLMModel.slug == m["slug"]))
        if existing:
            # Update pricing in case it changed
            existing.input_per_1m = m["input_per_1m"]
            existing.output_per_1m = m["output_per_1m"]
            existing.batch_per_1m = m.get("batch_per_1m")
            existing.cached_input_per_1m = m.get("cached_input_per_1m")
            existing.task_fit = m.get("task_fit", {})
            continue
        provider = provider_map[m["provider"]]
        model = LLMModel(
            provider_id=provider.id,
            slug=m["slug"],
            display_name=m["display_name"],
            context_window=m.get("context_window"),
            input_per_1m=m["input_per_1m"],
            output_per_1m=m["output_per_1m"],
            batch_per_1m=m.get("batch_per_1m"),
            cached_input_per_1m=m.get("cached_input_per_1m"),
            volume_tiers=m.get("volume_tiers", []),
            task_fit=m.get("task_fit", {}),
        )
        session.add(model)
        await session.flush()

        bench = benchmarks_data.get(m["slug"])
        if bench:
            bm = ModelBenchmark(
                model_id=model.id,
                mmlu=bench.get("mmlu"),
                human_eval=bench.get("human_eval"),
                math=bench.get("math"),
                reasoning=bench.get("reasoning"),
                speed_tps=bench.get("speed_tps"),
            )
            session.add(bm)


async def run_seed(mode: str) -> None:
    await create_tables()

    async with AsyncSessionLocal() as session:
        async with session.begin():
            if mode == "fictional":
                print("Seeding fictional providers and models…")
                await seed_providers_and_models(session)
                print("Seeding task categories…")
                await seed_task_categories(session)
                print("Seeding admin user…")
                admin = await seed_admin_user(session)
                print("Seeding demo project (TaskFlow)…")
                await seed_demo_project(session, admin)
                print("Done. Admin credentials: admin@example.com / admin1234")
            elif mode == "real":
                print("Seeding real commercial LLM providers (OpenAI, Anthropic, Google, Mistral, Meta)…")
                print("Note: prices are approximate as of early 2025. Use the refresh endpoint to update.")
                await seed_real_providers_and_models(session)
                print("Seeding task categories…")
                await seed_task_categories(session)
                print("Seeding admin user…")
                await seed_admin_user(session)
                print("Done. Admin credentials: admin@example.com / admin1234")
            else:
                print(f"Unknown mode: {mode}")
                sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the database")
    parser.add_argument("--mode", choices=["fictional", "real"], default="fictional")
    args = parser.parse_args()
    asyncio.run(run_seed(args.mode))


if __name__ == "__main__":
    main()
