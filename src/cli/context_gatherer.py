"""
Context gathering for task execution.
Gathers repository context, file contents, and relevant information.
"""
import logging
import os
import subprocess
from pathlib import Path
from typing import Optional

from ..core.models import Task

logger = logging.getLogger(__name__)


class ContextGatherer:
    """Gathers context for task execution."""

    def __init__(self, max_context_size: int = 50000):
        self.max_context_size = max_context_size

    async def gather_context(self, task: Task, repo_path: Path) -> str:
        """Gather context for a task."""
        context_parts = []

        # Add task description
        context_parts.append(f"# Task: {task.description}")
        context_parts.append(f"Priority: {task.priority}")
        context_parts.append(f"Subagent Type: {task.subagent_type}")

        if task.files_to_modify:
            context_parts.append(f"\nFiles to modify: {', '.join(task.files_to_modify)}")

        # Gather repository context
        repo_context = await self._gather_repo_context(repo_path)
        context_parts.append(repo_context)

        # Gather file context for files mentioned in task
        file_context = await self._gather_file_context(task, repo_path)
        if file_context:
            context_parts.append(file_context)

        # Gather git context
        git_context = await self._gather_git_context(repo_path)
        context_parts.append(git_context)

        # Truncate if too large
        full_context = "\n".join(context_parts)
        if len(full_context) > self.max_context_size:
            full_context = full_context[:self.max_context_size] + "\n... [context truncated]"

        return full_context

    async def _gather_repo_context(self, repo_path: Path) -> str:
        """Gather general repository context."""
        context_parts = []

        # Get repo structure
        try:
            result = subprocess.run(
                ["find", ".", "-type", "f", "-not", "-path", "*/node_modules/*", "-not", "-path", "*/.git/*", "-not", "-path", "*/venv/*", "-not", "-path", "*/__pycache__/*"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                files = result.stdout.strip().split("\n")
                context_parts.append(f"\n## Repository Structure ({len(files)} files)")
                # Limit to first 100 files
                for f in files[:100]:
                    context_parts.append(f"  {f}")
                if len(files) > 100:
                    context_parts.append(f"  ... and {len(files) - 100} more files")
        except Exception as e:
            logger.warning(f"Failed to get repo structure: {e}")

        # Check for common config files
        config_files = [
            "package.json", "tsconfig.json", "pyproject.toml", "setup.py",
            "Makefile", "Dockerfile", "docker-compose.yml", ".env.example",
            "README.md", "AGENTS.md", "CLAUDE.md",
        ]
        for config_file in config_files:
            config_path = repo_path / config_file
            if config_path.exists():
                try:
                    content = config_path.read_text(encoding="utf-8")
                    if len(content) > 1000:
                        content = content[:1000] + "\n... [truncated]"
                    context_parts.append(f"\n## {config_file}")
                    context_parts.append(content)
                except Exception:
                    pass

        return "\n".join(context_parts)

    async def _gather_file_context(self, task: Task, repo_path: Path) -> str:
        """Gather context for files mentioned in the task."""
        context_parts = []

        if not task.files_to_modify:
            return ""

        for file_path in task.files_to_modify:
            full_path = repo_path / file_path
            if full_path.exists():
                try:
                    content = full_path.read_text(encoding="utf-8")
                    if len(content) > 5000:
                        content = content[:5000] + "\n... [truncated]"
                    context_parts.append(f"\n## {file_path}")
                    context_parts.append(content)
                except Exception as e:
                    logger.warning(f"Failed to read {file_path}: {e}")
            else:
                context_parts.append(f"\n## {file_path} (NEW FILE)")

        return "\n".join(context_parts)

    async def _gather_git_context(self, repo_path: Path) -> str:
        """Gather git context."""
        context_parts = []

        try:
            # Get current branch
            result = subprocess.run(
                ["git", "branch", "--show-current"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                context_parts.append(f"\n## Git Branch: {result.stdout.strip()}")

            # Get recent commits
            result = subprocess.run(
                ["git", "log", "--oneline", "-10"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                context_parts.append("\n## Recent Commits")
                context_parts.append(result.stdout.strip())

            # Get working tree status
            result = subprocess.run(
                ["git", "status", "--short"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0 and result.stdout.strip():
                context_parts.append("\n## Working Tree Status")
                context_parts.append(result.stdout.strip())

        except Exception as e:
            logger.warning(f"Failed to gather git context: {e}")

        return "\n".join(context_parts)
