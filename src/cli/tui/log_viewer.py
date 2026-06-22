"""
Log viewer widget for displaying task output.
"""
from textual.app import ComposeResult
from textual.widgets import RichLog, Static
from textual.reactive import reactive


class LogViewer(Static):
    """Widget for viewing task logs."""

    content: reactive[str] = reactive("")

    def __init__(self, id: str = None):
        super().__init__("", id=id)
        self._log = RichLog(highlight=True, markup=True)

    def compose(self) -> ComposeResult:
        """Compose the log viewer."""
        yield self._log

    def set_content(self, content: str) -> None:
        """Set the log content."""
        self.content = content
        self._log.clear()
        if content:
            self._log.write(content)

    def append_content(self, content: str) -> None:
        """Append content to the log."""
        self.content += content
        self._log.write(content)

    def clear(self) -> None:
        """Clear the log viewer."""
        self.content = ""
        self._log.clear()
