"""
Main TUI application for task execution.
"""
import asyncio
import logging
from pathlib import Path
from typing import Optional

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.reactive import reactive
from textual.widgets import (
    Button,
    DataTable,
    Footer,
    Header,
    Input,
    Label,
    ProgressBar,
    RichLog,
    Select,
    Static,
)
from textual.binding import Binding
from textual import on, work

from ...core.models import Task, TaskResult, AgentPlan
from ...core.storage import StateStore
from ..executor import TaskExecutor, LocalExecutor
from ..planner import TaskPlanner
from ..context_gatherer import ContextGatherer
from ..quality_gates import QualityGateRunner
from .task_panel import TaskPanel
from .log_viewer import LogViewer
from .status_bar import StatusBar

logger = logging.getLogger(__name__)


class TaskMasterTUI(App):
    """Main TUI application for task execution."""

    CSS = """
    Screen {
        layout: grid;
        grid-size: 2;
        grid-rows: 1fr 3;
        grid-columns: 1fr 1fr;
    }

    #sidebar {
        row-span: 2;
        border-right: solid $primary;
    }

    #main {
        column-span: 2;
    }

    #footer {
        column-span: 2;
    }

    .task-list {
        height: 100%;
        overflow-y: auto;
    }

    .task-item {
        height: 3;
        padding: 0 1;
        border-bottom: solid $surface-darken-1;
    }

    .task-item:hover {
        background: $surface-darken-1;
    }

    .task-item.selected {
        background: $primary-darken-1;
    }

    .log-panel {
        height: 100%;
        overflow-y: auto;
        padding: 1;
    }

    .status-bar {
        dock: bottom;
        height: 3;
        background: $surface-darken-1;
        padding: 0 1;
    }
    """

    BINDINGS = [
        Binding("q", "quit", "Quit"),
        Binding("n", "new_task", "New Task"),
        Binding("r", "run_task", "Run Task"),
        Binding("c", "cancel_task", "Cancel Task"),
        Binding("d", "delete_task", "Delete Task"),
        Binding("l", "view_logs", "View Logs"),
        Binding("s", "sync", "Sync"),
        Binding("enter", "select_task", "Select Task"),
    ]

    def __init__(
        self,
        executor: TaskExecutor,
        planner: TaskPlanner,
        context_gatherer: ContextGatherer,
        quality_gates: QualityGateRunner,
        state_store: StateStore,
        repo_path: Path,
    ):
        super().__init__()
        self.executor = executor
        self.planner = planner
        self.context_gatherer = context_gatherer
        self.quality_gates = quality_gates
        self.state_store = state_store
        self.repo_path = repo_path

        self.tasks: list[Task] = []
        self.selected_task: Optional[Task] = None
        self.is_running = False

    def compose(self) -> ComposeResult:
        """Compose the TUI layout."""
        yield Header()

        with Vertical(id="sidebar"):
            yield Label("Tasks", id="sidebar-title")
            yield DataTable(id="task-table")
            with Horizontal():
                yield Button("New", id="new-btn", variant="primary")
                yield Button("Run", id="run-btn", variant="success")
                yield Button("Cancel", id="cancel-btn", variant="warning")
                yield Button("Delete", id="delete-btn", variant="error")

        with Vertical(id="main"):
            yield TaskPanel(id="task-panel")
            yield LogViewer(id="log-viewer")

        yield StatusBar(id="status-bar")
        yield Footer()

    async def on_mount(self) -> None:
        """Initialize the TUI."""
        await self._load_tasks()
        self._update_status()

    async def _load_tasks(self):
        """Load tasks from state store."""
        try:
            self.tasks = await self.state_store.list_tasks()
            self._refresh_task_table()
        except Exception as e:
            logger.error(f"Failed to load tasks: {e}")

    def _refresh_task_table(self):
        """Refresh the task table."""
        table = self.query_one("#task-table", DataTable)
        table.clear()
        table.add_columns("ID", "Description", "Status", "Priority")

        for task in self.tasks:
            status_icon = {
                "pending": "⏳",
                "in_progress": "🔄",
                "completed": "✅",
                "failed": "❌",
                "cancelled": "🚫",
            }.get(task.status, "❓")

            table.add_row(
                task.id[:8],
                task.description[:50],
                f"{status_icon} {task.status}",
                task.priority,
                key=task.id,
            )

    def _update_status(self):
        """Update the status bar."""
        status_bar = self.query_one("#status-bar", StatusBar)
        pending = sum(1 for t in self.tasks if t.status == "pending")
        in_progress = sum(1 for t in self.tasks if t.status == "in_progress")
        completed = sum(1 for t in self.tasks if t.status == "completed")

        status_bar.update(
            f"Tasks: {len(self.tasks)} total | "
            f"⏳ {pending} pending | "
            f"🔄 {in_progress} in progress | "
            f"✅ {completed} completed"
        )

    @on(DataTable.RowSelected)
    async def on_row_selected(self, event: DataTable.RowSelected) -> None:
        """Handle row selection in task table."""
        task_id = event.row_key.value
        self.selected_task = next((t for t in self.tasks if t.id == task_id), None)

        if self.selected_task:
            task_panel = self.query_one("#task-panel", TaskPanel)
            task_panel.show_task(self.selected_task)

            # Load task logs
            log_viewer = self.query_one("#log-viewer", LogViewer)
            output = await self.state_store.get_output(task_id)
            if output:
                log_viewer.set_content(output.stdout)

    @on(Button.Pressed, "#new-btn")
    async def on_new_task(self) -> None:
        """Handle new task button."""
        await self.action_new_task()

    @on(Button.Pressed, "#run-btn")
    async def on_run_task(self) -> None:
        """Handle run task button."""
        await self.action_run_task()

    @on(Button.Pressed, "#cancel-btn")
    async def on_cancel_task(self) -> None:
        """Handle cancel task button."""
        await self.action_cancel_task()

    @on(Button.Pressed, "#delete-btn")
    async def on_delete_task(self) -> None:
        """Handle delete task button."""
        await self.action_delete_task()

    async def action_new_task(self) -> None:
        """Create a new task."""
        # This would open a dialog to create a new task
        self.notify("New task dialog not yet implemented")

    async def action_run_task(self) -> None:
        """Run the selected task."""
        if not self.selected_task:
            self.notify("No task selected", severity="warning")
            return

        if self.is_running:
            self.notify("A task is already running", severity="warning")
            return

        self.is_running = True
        self._update_status()

        try:
            # Gather context
            context = await self.context_gatherer.gather_context(
                self.selected_task, self.repo_path
            )

            # Create environment
            from ...core.models import Environment
            environment = Environment(
                id=f"env-{self.selected_task.id}",
                name="Local",
                type="local",
                working_dir=self.repo_path,
            )

            # Execute task
            result = await self.executor.execute(self.selected_task, environment)

            # Run quality gates
            result = await self.quality_gates.run_all(self.repo_path, result)

            # Update task status
            self.selected_task.status = result.status
            await self.state_store.update_task(self.selected_task)

            # Store result
            await self.state_store.store_result(result)

            self.notify(f"Task {result.status}", severity="success" if result.status == "success" else "error")

        except Exception as e:
            logger.error(f"Task execution failed: {e}")
            self.notify(f"Task failed: {e}", severity="error")

        finally:
            self.is_running = False
            self._update_status()
            await self._load_tasks()

    async def action_cancel_task(self) -> None:
        """Cancel the selected task."""
        if not self.selected_task:
            self.notify("No task selected", severity="warning")
            return

        success = await self.executor.cancel(self.selected_task.id)
        if success:
            self.selected_task.status = "cancelled"
            await self.state_store.update_task(self.selected_task)
            self.notify("Task cancelled", severity="warning")
            await self._load_tasks()
        else:
            self.notify("Failed to cancel task", severity="error")

    async def action_delete_task(self) -> None:
        """Delete the selected task."""
        if not self.selected_task:
            self.notify("No task selected", severity="warning")
            return

        # This would show a confirmation dialog
        self.notify("Delete task not yet implemented")

    async def action_view_logs(self) -> None:
        """View logs for the selected task."""
        if not self.selected_task:
            self.notify("No task selected", severity="warning")
            return

        log_viewer = self.query_one("#log-viewer", LogViewer)
        output = await self.state_store.get_output(self.selected_task.id)
        if output:
            log_viewer.set_content(output.stdout)
        else:
            log_viewer.set_content("No logs available")

    async def action_sync(self) -> None:
        """Sync tasks with remote."""
        self.notify("Sync not yet implemented")

    async def action_select_task(self) -> None:
        """Select the current task."""
        pass
