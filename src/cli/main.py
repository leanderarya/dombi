"""
Main CLI entry point for Dombi Task Master.
"""
import asyncio
import logging
import sys
from pathlib import Path
from typing import Optional

import click

from ..core.models import Task, Environment
from ..core.storage import StateStore
from ..core.planner import TaskPlanner
from .executor import LocalExecutor, HybridExecutor
from .context_gatherer import ContextGatherer
from .quality_gates import QualityGateRunner
from ..sandbox.manager import SandboxManager

logger = logging.getLogger(__name__)


def setup_logging(verbose: bool):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )


@click.group()
@click.option("--verbose", "-v", is_flag=True, help="Enable verbose logging")
@click.pass_context
def cli(ctx, verbose):
    """Dombi Task Master - Autonomous task execution system."""
    setup_logging(verbose)
    ctx.ensure_object(dict)
    ctx.obj["verbose"] = verbose


@cli.command()
@click.argument("description")
@click.option("--priority", "-p", default="medium", help="Task priority")
@click.option("--subagent-type", "-t", default="local", help="Subagent type")
@click.option("--files", "-f", multiple=True, help="Files to modify")
@click.option("--criteria", "-c", multiple=True, help="Acceptance criteria")
@click.pass_context
def create(ctx, description, priority, subagent_type, files, criteria):
    """Create a new task."""
    task = Task(
        id="",  # Will be generated
        description=description,
        priority=priority,
        subagent_type=subagent_type,
        files_to_modify=list(files),
        acceptance_criteria=list(criteria),
    )

    async def _create():
        store = StateStore()
        await store.store_task(task)
        click.echo(f"✅ Created task: {task.id}")
        click.echo(f"   Description: {task.description}")
        click.echo(f"   Priority: {task.priority}")
        click.echo(f"   Subagent Type: {task.subagent_type}")

    asyncio.run(_create())


@cli.command("list")
@click.option("--status", "-s", help="Filter by status")
@click.option("--limit", "-l", default=20, help="Limit number of tasks")
@click.pass_context
def list_tasks(ctx, status, limit):
    """List tasks."""
    async def _list():
        store = StateStore()
        tasks = await store.list_tasks()

        if status:
            tasks = [t for t in tasks if t.status == status]

        tasks = tasks[:limit]

        if not tasks:
            click.echo("No tasks found.")
            return

        click.echo(f"Found {len(tasks)} tasks:")
        click.echo("-" * 80)

        for task in tasks:
            status_icon = {
                "pending": "⏳",
                "in_progress": "🔄",
                "completed": "✅",
                "failed": "❌",
                "cancelled": "🚫",
            }.get(task.status, "❓")

            click.echo(f"{status_icon} {task.id[:8]} | {task.description[:50]}")
            click.echo(f"   Status: {task.status} | Priority: {task.priority}")

    asyncio.run(_list())


@cli.command()
@click.argument("task_id")
@click.pass_context
def show(ctx, task_id):
    """Show task details."""
    async def _show():
        store = StateStore()
        task = await store.get_task(task_id)

        if not task:
            click.echo(f"❌ Task {task_id} not found")
            return

        click.echo(f"Task: {task.id}")
        click.echo(f"Description: {task.description}")
        click.echo(f"Status: {task.status}")
        click.echo(f"Priority: {task.priority}")
        click.echo(f"Subagent Type: {task.subagent_type}")

        if task.files_to_modify:
            click.echo(f"Files to modify: {', '.join(task.files_to_modify)}")

        if task.acceptance_criteria:
            click.echo("Acceptance Criteria:")
            for criteria in task.acceptance_criteria:
                click.echo(f"  - {criteria}")

    asyncio.run(_show())


@cli.command()
@click.argument("task_id")
@click.pass_context
def run(ctx, task_id):
    """Run a task."""
    async def _run():
        store = StateStore()
        task = await store.get_task(task_id)

        if not task:
            click.echo(f"❌ Task {task_id} not found")
            return

        click.echo(f"🚀 Running task: {task.description[:50]}...")

        # Create components
        sandbox_manager = SandboxManager()
        executor = LocalExecutor(store, sandbox_manager)
        context_gatherer = ContextGatherer()
        quality_gates = QualityGateRunner({})

        # Gather context
        context = await context_gatherer.gather_context(task, Path.cwd())

        # Create environment
        environment = Environment(
            id=f"env-{task.id}",
            name="Local",
            type="local",
            working_dir=Path.cwd(),
        )

        # Execute task
        result = await executor.execute(task, environment)

        # Run quality gates
        result = await quality_gates.run_all(Path.cwd(), result)

        # Update task status
        task.status = result.status
        await store.update_task(task)

        # Store result
        await store.store_result(result)

        if result.status == "success":
            click.echo(f"✅ Task completed successfully")
            click.echo(f"   Duration: {result.duration_seconds:.1f}s")
            click.echo(f"   Exit Code: {result.exit_code}")
        else:
            click.echo(f"❌ Task failed")
            click.echo(f"   Error: {result.error_message}")
            click.echo(f"   Exit Code: {result.exit_code}")

    asyncio.run(_run())


@cli.command()
@click.argument("task_id")
@click.pass_context
def cancel(ctx, task_id):
    """Cancel a running task."""
    async def _cancel():
        store = StateStore()
        sandbox_manager = SandboxManager()
        executor = LocalExecutor(store, sandbox_manager)

        success = await executor.cancel(task_id)

        if success:
            task = await store.get_task(task_id)
            if task:
                task.status = "cancelled"
                await store.update_task(task)
            click.echo(f"✅ Cancelled task {task_id}")
        else:
            click.echo(f"❌ Failed to cancel task {task_id}")

    asyncio.run(_cancel())


@cli.command()
@click.pass_context
def tui(ctx):
    """Launch the terminal UI."""
    try:
        from .tui.app import TaskMasterTUI

        async def _tui():
            store = StateStore()
            sandbox_manager = SandboxManager()
            executor = LocalExecutor(store, sandbox_manager)
            planner = TaskPlanner({})
            context_gatherer = ContextGatherer()
            quality_gates = QualityGateRunner({})

            app = TaskMasterTUI(
                executor=executor,
                planner=planner,
                context_gatherer=context_gatherer,
                quality_gates=quality_gates,
                state_store=store,
                repo_path=Path.cwd(),
            )

            await app.run_async()

        asyncio.run(_tui())

    except ImportError as e:
        click.echo(f"❌ TUI dependencies not installed: {e}")
        click.echo("   Install with: pip install textual")


@cli.command()
@click.pass_context
def status(ctx):
    """Show system status."""
    async def _status():
        store = StateStore()
        tasks = await store.list_tasks()

        total = len(tasks)
        pending = sum(1 for t in tasks if t.status == "pending")
        in_progress = sum(1 for t in tasks if t.status == "in_progress")
        completed = sum(1 for t in tasks if t.status == "completed")
        failed = sum(1 for t in tasks if t.status == "failed")
        cancelled = sum(1 for t in tasks if t.status == "cancelled")

        click.echo("📊 System Status")
        click.echo("-" * 40)
        click.echo(f"Total Tasks: {total}")
        click.echo(f"⏳ Pending: {pending}")
        click.echo(f"🔄 In Progress: {in_progress}")
        click.echo(f"✅ Completed: {completed}")
        click.echo(f"❌ Failed: {failed}")
        click.echo(f"🚫 Cancelled: {cancelled}")

    asyncio.run(_status())


@cli.command()
@click.pass_context
def init(ctx):
    """Initialize Task Master in the current repository."""
    click.echo("🔧 Initializing Task Master...")

    # Create .task-master directory
    task_master_dir = Path.cwd() / ".task-master"
    task_master_dir.mkdir(exist_ok=True)

    # Create config file
    config_file = task_master_dir / "config.json"
    if not config_file.exists():
        import json
        config = {
            "version": "1.0.0",
            "storage_dir": ".task-master",
            "log_level": "INFO",
            "max_concurrent_tasks": 5,
            "default_priority": "medium",
            "quality_gates": {
                "test": {"required": True},
                "lint": {"required": False},
                "typecheck": {"required": False},
            },
        }
        config_file.write_text(json.dumps(config, indent=2))

    # Create tasks directory
    tasks_dir = task_master_dir / "tasks"
    tasks_dir.mkdir(exist_ok=True)

    # Create results directory
    results_dir = task_master_dir / "results"
    results_dir.mkdir(exist_ok=True)

    click.echo(f"✅ Initialized Task Master in {task_master_dir}")
    click.echo("   Next steps:")
    click.echo("   1. Review .task-master/config.json")
    click.echo("   2. Create a task: dombi create 'My first task'")
    click.echo("   3. Run the task: dombi run <task-id>")


if __name__ == "__main__":
    cli()
