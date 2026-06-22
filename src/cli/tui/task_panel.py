"""
Task panel widget for displaying task details.
"""
from typing import Optional

from textual.app import ComposeResult
from textual.containers import Vertical, Horizontal
from textual.widgets import Static, Label, Button
from textual.reactive import reactive

from ...core.models import Task


class TaskPanel(Vertical):
    """Panel for displaying task details."""

    task: reactive[Optional[Task]] = reactive(None)

    def __init__(self, id: str = None):
        super().__init__(id=id)
        self._task_id = ""
        self._description = ""
        self._status = ""
        self._priority = ""
        self._subagent_type = ""
        self._files = ""
        self._acceptance_criteria = ""

    def compose(self) -> ComposeResult:
        """Compose the task panel."""
        yield Label("Task Details", id="task-panel-title")
        yield Static("", id="task-id")
        yield Static("", id="task-description")
        yield Static("", id="task-status")
        yield Static("", id="task-priority")
        yield Static("", id="task-subagent-type")
        yield Static("", id="task-files")
        yield Static("", id="task-acceptance-criteria")

    def show_task(self, task: Task) -> None:
        """Display a task's details."""
        self.task = task

        self.query_one("#task-id", Static).update(f"ID: {task.id}")
        self.query_one("#task-description", Static).update(f"Description: {task.description}")
        self.query_one("#task-status", Static).update(f"Status: {task.status}")
        self.query_one("#task-priority", Static).update(f"Priority: {task.priority}")
        self.query_one("#task-subagent-type", Static).update(f"Subagent Type: {task.subagent_type}")

        if task.files_to_modify:
            files = ", ".join(task.files_to_modify)
            self.query_one("#task-files", Static).update(f"Files: {files}")
        else:
            self.query_one("#task-files", Static).update("Files: None specified")

        if task.acceptance_criteria:
            criteria = "\n".join(f"  - {c}" for c in task.acceptance_criteria)
            self.query_one("#task-acceptance-criteria", Static).update(f"Acceptance Criteria:\n{criteria}")
        else:
            self.query_one("#task-acceptance-criteria", Static).update("Acceptance Criteria: None specified")

    def clear(self) -> None:
        """Clear the task panel."""
        self.task = None
        self.query_one("#task-id", Static).update("")
        self.query_one("#task-description", Static).update("")
        self.query_one("#task-status", Static).update("")
        self.query_one("#task-priority", Static).update("")
        self.query_one("#task-subagent-type", Static).update("")
        self.query_one("#task-files", Static).update("")
        self.query_one("#task-acceptance-criteria", Static).update("")
