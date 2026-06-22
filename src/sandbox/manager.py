"""
Sandbox manager for managing execution environments.
"""
import logging
from typing import Dict, Optional

from ..core.models import Environment, SandboxStatus

logger = logging.getLogger(__name__)


class SandboxManager:
    """Manager for sandbox environments."""

    def __init__(self):
        self._sandboxes: Dict[str, SandboxStatus] = {}

    async def get_or_create(self, environment: Environment) -> SandboxStatus:
        """Get existing sandbox or create new one."""
        if environment.id in self._sandboxes:
            sandbox = self._sandboxes[environment.id]
            if sandbox.status == "running":
                return sandbox

        # Create new sandbox
        sandbox = SandboxStatus(
            id=f"sandbox-{environment.id}",
            status="creating",
            environment_id=environment.id,
        )

        self._sandboxes[environment.id] = sandbox

        # Simulate sandbox creation
        sandbox.status = "running"
        logger.info(f"Created sandbox {sandbox.id} for environment {environment.id}")

        return sandbox

    async def stop(self, environment_id: str) -> bool:
        """Stop a sandbox."""
        if environment_id in self._sandboxes:
            sandbox = self._sandboxes[environment_id]
            sandbox.status = "stopped"
            logger.info(f"Stopped sandbox {sandbox.id}")
            return True

        return False

    async def remove(self, environment_id: str) -> bool:
        """Remove a sandbox."""
        if environment_id in self._sandboxes:
            sandbox = self._sandboxes.pop(environment_id)
            logger.info(f"Removed sandbox {sandbox.id}")
            return True

        return False

    async def list_sandboxes(self) -> list[SandboxStatus]:
        """List all sandboxes."""
        return list(self._sandboxes.values())

    async def get_status(self, environment_id: str) -> Optional[SandboxStatus]:
        """Get sandbox status."""
        return self._sandboxes.get(environment_id)
