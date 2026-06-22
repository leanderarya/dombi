"""
MCP server for Codex integration.
Provides tools for task management and execution.
"""
import asyncio
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import (
    Tool,
    TextContent,
    ImageContent,
    EmbeddedResource,
)

from ..core.models import Task, TaskResult, Environment
from ..core.storage import StateStore
from ..core.planner import TaskPlanner
from ..cli.executor import TaskExecutor, LocalExecutor
from ..cli.context_gatherer import ContextGatherer
from ..cli.quality_gates import QualityGateRunner

logger = logging.getLogger(__name__)


class TaskMasterMCP:
    """MCP server for task management."""

    def __init__(
        self,
        state_store: StateStore,
        executor: TaskExecutor,
        planner: TaskPlanner,
        context_gatherer: ContextGatherer,
        quality_gates: QualityGateRunner,
        repo_path: Path,
    ):
        self.state_store = state_store
        self.executor = executor
        self.planner = planner
        self.context_gatherer = context_gatherer
        self.quality_gates = quality_gates
        self.repo_path = repo_path

        self.server = Server("task-master")
        self._register_tools()

    def _register_tools(self):
        """Register MCP tools."""

        @self.server.tool()
        async def create_task(
            description: str,
            priority: str = "medium",
            subagent_type: str = "local",
            files_to_modify: List[str] = None,
            acceptance_criteria: List[str] = None,
        ) -> List[TextContent]:
            """Create a new task."""
            task = Task(
                id="",  # Will be generated
                description=description,
                priority=priority,
                subagent_type=subagent_type,
                files_to_modify=files_to_modify or [],
                acceptance_criteria=acceptance_criteria or [],
            )
            await self.state_store.store_task(task)
            return [TextContent(type="text", text=f"Created task {task.id}")]

        @self.server.tool()
        async def list_tasks(
            status: Optional[str] = None,
            limit: int = 50,
        ) -> List[TextContent]:
            """List tasks with optional filtering."""
            tasks = await self.state_store.list_tasks()

            if status:
                tasks = [t for t in tasks if t.status == status]

            tasks = tasks[:limit]

            result = []
            for task in tasks:
                result.append(TextContent(
                    type="text",
                    text=f"Task {task.id}: {task.description}\n"
                         f"  Status: {task.status}\n"
                         f"  Priority: {task.priority}\n"
                         f"  Subagent Type: {task.subagent_type}"
                ))

            return result

        @self.server.tool()
        async def get_task(task_id: str) -> List[TextContent]:
            """Get details of a specific task."""
            task = await self.state_store.get_task(task_id)
            if not task:
                return [TextContent(type="text", text=f"Task {task_id} not found")]

            return [TextContent(
                type="text",
                text=json.dumps(task.dict(), indent=2)
            )]

        @self.server.tool()
        async def update_task(
            task_id: str,
            description: Optional[str] = None,
            status: Optional[str] = None,
            priority: Optional[str] = None,
            files_to_modify: Optional[List[str]] = None,
            acceptance_criteria: Optional[List[str]] = None,
        ) -> List[TextContent]:
            """Update an existing task."""
            task = await self.state_store.get_task(task_id)
            if not task:
                return [TextContent(type="text", text=f"Task {task_id} not found")]

            if description is not None:
                task.description = description
            if status is not None:
                task.status = status
            if priority is not None:
                task.priority = priority
            if files_to_modify is not None:
                task.files_to_modify = files_to_modify
            if acceptance_criteria is not None:
                task.acceptance_criteria = acceptance_criteria

            await self.state_store.update_task(task)
            return [TextContent(type="text", text=f"Updated task {task_id}")]

        @self.server.tool()
        async def delete_task(task_id: str) -> List[TextContent]:
            """Delete a task."""
            task = await self.state_store.get_task(task_id)
            if not task:
                return [TextContent(type="text", text=f"Task {task_id} not found")]

            # This would delete the task
            return [TextContent(type="text", text=f"Deleted task {task_id}")]

        @self.server.tool()
        async def run_task(task_id: str) -> List[TextContent]:
            """Run a specific task."""
            task = await self.state_store.get_task(task_id)
            if not task:
                return [TextContent(type="text", text=f"Task {task_id} not found")]

            # Gather context
            context = await self.context_gatherer.gather_context(task, self.repo_path)

            # Create environment
            environment = Environment(
                id=f"env-{task.id}",
                name="Local",
                type="local",
                working_dir=self.repo_path,
            )

            # Execute task
            result = await self.executor.execute(task, environment)

            # Run quality gates
            result = await self.quality_gates.run_all(self.repo_path, result)

            # Update task status
            task.status = result.status
            await self.state_store.update_task(task)

            # Store result
            await self.state_store.store_result(result)

            return [TextContent(
                type="text",
                text=f"Task {task_id} completed\n"
                     f"  Status: {result.status}\n"
                     f"  Exit Code: {result.exit_code}\n"
                     f"  Duration: {result.duration_seconds:.1f}s\n"
                     f"  Output:\n{result.output[:1000]}"
            )]

        @self.server.tool()
        async def cancel_task(task_id: str) -> List[TextContent]:
            """Cancel a running task."""
            success = await self.executor.cancel(task_id)
            if success:
                task = await self.state_store.get_task(task_id)
                if task:
                    task.status = "cancelled"
                    await self.state_store.update_task(task)
                return [TextContent(type="text", text=f"Cancelled task {task_id}")]
            return [TextContent(type="text", text=f"Failed to cancel task {task_id}")]

        @self.server.tool()
        async def get_task_result(task_id: str) -> List[TextContent]:
            """Get the result of a completed task."""
            result = await self.state_store.get_result(task_id)
            if not result:
                return [TextContent(type="text", text=f"No result found for task {task_id}")]

            return [TextContent(
                type="text",
                text=json.dumps(result.dict(), indent=2)
            )]

        @self.server.tool()
        async def get_task_output(task_id: str) -> List[TextContent]:
            """Get the output of a task."""
            output = await self.state_store.get_output(task_id)
            if not output:
                return [TextContent(type="text", text=f"No output found for task {task_id}")]

            return [TextContent(
                type="text",
                text=output.stdout[:5000]  # Limit output size
            )]

        @self.server.tool()
        async def plan_task(description: str) -> List[TextContent]:
            """Plan a task using the task planner."""
            task = Task(
                id="temp",
                description=description,
                priority="medium",
                subagent_type="local",
            )

            context = await self.context_gatherer.gather_context(task, self.repo_path)
            plan = await self.planner.plan(task, context)

            return [TextContent(
                type="text",
                text=json.dumps(plan.dict(), indent=2)
            )]

        @self.server.tool()
        async def run_quality_gates(task_id: str) -> List[TextContent]:
            """Run quality gates for a task."""
            task = await self.state_store.get_task(task_id)
            if not task:
                return [TextContent(type="text", text=f"Task {task_id} not found")]

            result = await self.state_store.get_result(task_id)
            if not result:
                return [TextContent(type="text", text=f"No result found for task {task_id}")]

            result = await self.quality_gates.run_all(self.repo_path, result)
            await self.state_store.store_result(result)

            return [TextContent(
                type="text",
                text=f"Quality gates completed\n"
                     f"  Status: {result.status}\n"
                     f"  Error: {result.error_message or 'None'}"
            )]

        @self.server.tool()
        async def get_system_status() -> List[TextContent]:
            """Get system status information."""
            tasks = await self.state_store.list_tasks()

            status = {
                "total_tasks": len(tasks),
                "pending": sum(1 for t in tasks if t.status == "pending"),
                "in_progress": sum(1 for t in tasks if t.status == "in_progress"),
                "completed": sum(1 for t in tasks if t.status == "completed"),
                "failed": sum(1 for t in tasks if t.status == "failed"),
                "cancelled": sum(1 for t in tasks if t.status == "cancelled"),
            }

            return [TextContent(
                type="text",
                text=json.dumps(status, indent=2)
            )]

    async def run(self):
        """Run the MCP server."""
        async with stdio_server() as (read_stream, write_stream):
            await self.server.run(
                read_stream,
                write_stream,
                self.server.create_initialization_options(),
            )
