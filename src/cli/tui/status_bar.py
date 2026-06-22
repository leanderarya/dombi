"""
Status bar widget for displaying system status.
"""
from textual.widgets import Static
from textual.reactive import reactive


class StatusBar(Static):
    """Status bar widget."""

    status_text: reactive[str] = reactive("Ready")

    def __init__(self, id: str = None):
        super().__init__("", id=id)

    def update(self, text: str) -> None:
        """Update the status bar text."""
        self.status_text = text
        self.update(text)

    def render(self) -> str:
        """Render the status bar."""
        return self.status_text
