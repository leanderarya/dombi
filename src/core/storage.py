"""
State storage for the Dombi Task Master system.
"""
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import (
    Task,
    TaskResult,
    ExecutionOutput,
    SystemConfig,
)

logger = logging.getLogger(__name__)


class StateStore:
    """State storage manager."""

    def __init__(self, storage_dir: str = ".task-master"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # Create subdirectories
        (self.storage_dir / "tasks").mkdir(exist_ok=True)
        (self.storage_dir / "results").mkdir(exist_ok=True)
        (self.storage_dir / "output").mkdir(exist_ok=True)
        (self.storage_dir / "logs").mkdir(exist_ok=True)

    async def store_task(self, task: Task) -> None:
        """Store a task."""
        if not task.id:
            task.id = self._generate_id()

        task.updated_at = datetime.utcnow()
        task_file = self.storage_dir / "tasks" / f"{task.id}.json"

        with open(task_file, "w") as f:
            json.dump(task.dict(), f, indent=2, default=str)

        logger.debug(f"Stored task {task.id}")

    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get a task by ID."""
        task_file = self.storage_dir / "tasks" / f"{task_id}.json"

        if not task_file.exists():
            return None

        with open(task_file, "r") as f:
            data = json.load(f)

        return Task(**data)

    async def update_task(self, task: Task) -> None:
        """Update a task."""
        task.updated_at = datetime.utcnow()
        task_file = self.storage_dir / "tasks" / f"{task.id}.json"

        with open(task_file, "w") as f:
            json.dump(task.dict(), f, indent=2, default=str)

        logger.debug(f"Updated task {task.id}")

    async def delete_task(self, task_id: str) -> bool:
        """Delete a task."""
        task_file = self.storage_dir / "tasks" / f"{task_id}.json"

        if task_file.exists():
            task_file.unlink()
            logger.debug(f"Deleted task {task_id}")
            return True

        return False

    async def list_tasks(
        self,
        status: Optional[str] = None,
        limit: int = 100,
    ) -> List[Task]:
        """List tasks with optional filtering."""
        tasks = []
        tasks_dir = self.storage_dir / "tasks"

        for task_file in tasks_dir.glob("*.json"):
            try:
                with open(task_file, "r") as f:
                    data = json.load(f)

                task = Task(**data)

                if status and task.status != status:
                    continue

                tasks.append(task)

            except Exception as e:
                logger.warning(f"Failed to load task from {task_file}: {e}")

        # Sort by updated_at descending
        tasks.sort(key=lambda t: t.updated_at, reverse=True)

        return tasks[:limit]

    async def store_result(self, result: TaskResult) -> None:
        """Store a task result."""
        result_file = self.storage_dir / "results" / f"{result.task_id}.json"

        with open(result_file, "w") as f:
            json.dump(result.dict(), f, indent=2, default=str)

        logger.debug(f"Stored result for task {result.task_id}")

    async def get_result(self, task_id: str) -> Optional[TaskResult]:
        """Get a task result."""
        result_file = self.storage_dir / "results" / f"{task_id}.json"

        if not result_file.exists():
            return None

        with open(result_file, "r") as f:
            data = json.load(f)

        return TaskResult(**data)

    async def store_output(self, task_id: str, output: ExecutionOutput) -> None:
        """Store task output."""
        output_file = self.storage_dir / "output" / f"{task_id}.json"

        with open(output_file, "w") as f:
            json.dump(output.dict(), f, indent=2, default=str)

        logger.debug(f"Stored output for task {task_id}")

    async def get_output(self, task_id: str) -> Optional[ExecutionOutput]:
        """Get task output."""
        output_file = self.storage_dir / "output" / f"{task_id}.json"

        if not output_file.exists():
            return None

        with open(output_file, "r") as f:
            data = json.load(f)

        return ExecutionOutput(**data)

    async def append_output(self, task_id: str, output: ExecutionOutput) -> None:
        """Append to task output."""
        existing = await self.get_output(task_id)

        if existing:
            existing.stdout += output.stdout
            existing.stderr += output.stderr
            existing.truncated = existing.truncated or output.truncated
            await self.store_output(task_id, existing)
        else:
            await self.store_output(task_id, output)

    async def update_heartbeat(self, task_id: str) -> None:
        """Update task heartbeat timestamp."""
        # This would update a heartbeat timestamp for monitoring
        pass

    async def store_config(self, config: SystemConfig) -> None:
        """Store system configuration."""
        config_file = self.storage_dir / "config.json"

        with open(config_file, "w") as f:
            json.dump(config.dict(), f, indent=2, default=str)

    async def get_config(self) -> Optional[SystemConfig]:
        """Get system configuration."""
        config_file = self.storage_dir / "config.json"

        if not config_file.exists():
            return None

        with open(config_file, "r") as f:
            data = json.load(f)

        return SystemConfig(**data)

    def _generate_id(self) -> str:
        """Generate a unique ID."""
        import uuid
        return str(uuid.uuid4())
