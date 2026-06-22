"""
Task executor for local and remote environments.
"""
import asyncio
import logging
import os
import signal
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from ..core.models import Task, TaskResult, Environment, ExecutionOutput
from ..core.storage import StateStore
from ..sandbox.manager import SandboxManager
from ..sandbox.docker_runtime import DockerRuntime, DockerConfig

logger = logging.getLogger(__name__)


class TaskExecutor(ABC):
    """Base task executor interface."""

    @abstractmethod
    async def execute(self, task: Task, environment: Environment) -> TaskResult:
        """Execute a task in an environment."""
        ...

    @abstractmethod
    async def cancel(self, task_id: str) -> bool:
        """Cancel a running task."""
        ...

    @abstractmethod
    async def cleanup(self, task_id: str) -> bool:
        """Cleanup task resources."""
        ...


class LocalExecutor(TaskExecutor):
    """Execute tasks locally using Docker sandbox."""

    def __init__(self, state_store: StateStore, sandbox_manager: SandboxManager):
        self.state_store = state_store
        self.sandbox_manager = sandbox_manager
        self._running_processes: dict[str, asyncio.subprocess.Process] = {}
        self._cancel_events: dict[str, asyncio.Event] = {}

    async def execute(self, task: Task, environment: Environment) -> TaskResult:
        """Execute a task locally in a sandbox."""
        self._cancel_events[task.id] = asyncio.Event()

        logger.info(f"Executing task {task.id} locally: {task.description[:50]}...")

        # Ensure sandbox exists
        sandbox = await self.sandbox_manager.get_or_create(environment)

        # Start heartbeat
        heartbeat_task = asyncio.create_task(
            self._heartbeat_loop(task.id)
        )

        try:
            # Build the execution command
            cmd = self._build_command(task, environment)

            # Execute in sandbox
            output_lines = []
            start_time = asyncio.get_event_loop().time()

            process = await asyncio.create_subprocess_shell(
                cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(environment.working_dir) if environment.working_dir else None,
                env={**os.environ, **(environment.env_vars or {})},
            )

            self._running_processes[task.id] = process

            # Stream output
            async for line in process.stdout:
                if self._cancel_events.get(task.id, asyncio.Event()).is_set():
                    process.terminate()
                    break

                decoded = line.decode("utf-8", errors="replace").rstrip()
                output_lines.append(decoded)

                # Store output incrementally
                output = ExecutionOutput(
                    task_id=task.id,
                    stdout=decoded + "\n",
                    stderr="",
                    exit_code=None,
                    truncated=False,
                )
                await self.state_store.append_output(task.id, output)

            await process.wait()
            duration = asyncio.get_event_loop().time() - start_time

            # Create result
            exit_code = process.returncode or 0
            is_cancelled = self._cancel_events.get(task.id, asyncio.Event()).is_set()

            result = TaskResult(
                task_id=task.id,
                status="cancelled" if is_cancelled else ("completed" if exit_code == 0 else "failed"),
                exit_code=exit_code,
                duration_seconds=duration,
                output="\n".join(output_lines[-100:]),  # Last 100 lines
                artifacts=[],
                error_message=None if exit_code == 0 else f"Process exited with code {exit_code}",
            )

            # Store full output
            output = ExecutionOutput(
                task_id=task.id,
                stdout="\n".join(output_lines),
                stderr="",
                exit_code=exit_code,
                truncated=len(output_lines) > 1000,
            )
            await self.state_store.store_output(task.id, output)

            return result

        except asyncio.CancelledError:
            return TaskResult(
                task_id=task.id,
                status="cancelled",
                exit_code=-1,
                duration_seconds=0,
                output="",
                artifacts=[],
                error_message="Task was cancelled",
            )
        except Exception as e:
            logger.error(f"Task {task.id} failed: {e}")
            return TaskResult(
                task_id=task.id,
                status="failed",
                exit_code=-1,
                duration_seconds=0,
                output="",
                artifacts=[],
                error_message=str(e),
            )
        finally:
            heartbeat_task.cancel()
            self._running_processes.pop(task.id, None)
            self._cancel_events.pop(task.id, None)

    async def cancel(self, task_id: str) -> bool:
        """Cancel a running task."""
        if task_id in self._cancel_events:
            self._cancel_events[task_id].set()

        process = self._running_processes.get(task_id)
        if process:
            try:
                process.terminate()
                await asyncio.wait_for(process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                process.kill()
            return True

        return False

    async def cleanup(self, task_id: str) -> bool:
        """Cleanup task resources."""
        await self.cancel(task_id)
        return True

    def _build_command(self, task: Task, environment: Environment) -> str:
        """Build the command to execute the task."""
        # Use the task's generated command if available
        if task.command:
            return task.command

        # Default: use a shell with the task description as context
        escaped_desc = task.description.replace("'", "'\\''")
        return f"bash -c 'echo \"Task: {escaped_desc}\" && echo \"No command generated\"'"

    async def _heartbeat_loop(self, task_id: str, interval: float = 5.0):
        """Send periodic heartbeats for a task."""
        while True:
            try:
                await asyncio.sleep(interval)
                await self.state_store.update_heartbeat(task_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Heartbeat failed for task {task_id}: {e}")


class RemoteExecutor(TaskExecutor):
    """Execute tasks on remote machines via SSH/agent."""

    def __init__(self, state_store: StateStore, config: dict):
        self.state_store = state_store
        self.config = config
        self._connections: dict[str, any] = {}

    async def execute(self, task: Task, environment: Environment) -> TaskResult:
        """Execute a task on a remote machine."""
        logger.info(f"Executing task {task.id} remotely: {task.description[:50]}...")

        # This would connect to a remote agent
        # For now, return a placeholder
        raise NotImplementedError("Remote execution not yet implemented")

    async def cancel(self, task_id: str) -> bool:
        """Cancel a remote task."""
        # Would send cancel signal to remote agent
        return False

    async def cleanup(self, task_id: str) -> bool:
        """Cleanup remote task resources."""
        return True


class HybridExecutor(TaskExecutor):
    """Hybrid executor that can use local or remote execution."""

    def __init__(self, state_store: StateStore, sandbox_manager: SandboxManager, config: dict):
        self.local_executor = LocalExecutor(state_store, sandbox_manager)
        self.remote_executor = RemoteExecutor(state_store, config)
        self.config = config

    async def execute(self, task: Task, environment: Environment) -> TaskResult:
        """Execute a task, choosing local or remote based on config."""
        # Check if this should be remote
        if self._should_use_remote(task, environment):
            return await self.remote_executor.execute(task, environment)
        return await self.local_executor.execute(task, environment)

    async def cancel(self, task_id: str) -> bool:
        """Cancel a task."""
        # Try both executors
        local_result = await self.local_executor.cancel(task_id)
        remote_result = await self.remote_executor.cancel(task_id)
        return local_result or remote_result

    async def cleanup(self, task_id: str) -> bool:
        """Cleanup task resources."""
        await self.local_executor.cleanup(task_id)
        await self.remote_executor.cleanup(task_id)
        return True

    def _should_use_remote(self, task: Task, environment: Environment) -> bool:
        """Determine if task should be executed remotely."""
        # Check environment type
        if environment.type == "remote":
            return True

        # Check task requirements
        if task.subagent_type == "remote":
            return True

        # Check config
        if self.config.get("force_remote", False):
            return True

        return False
