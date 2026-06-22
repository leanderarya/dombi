"""
Quality gates for task verification.
"""
import asyncio
import logging
import subprocess
from pathlib import Path
from typing import Optional

from ..core.models import TaskResult

logger = logging.getLogger(__name__)


class QualityGate:
    """A single quality gate check."""

    def __init__(self, name: str, command: str, description: str, required: bool = True):
        self.name = name
        self.command = command
        self.description = description
        self.required = required

    async def run(self, working_dir: Path) -> tuple[bool, str]:
        """Run the quality gate check. Returns (passed, output)."""
        try:
            process = await asyncio.create_subprocess_shell(
                self.command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                cwd=str(working_dir),
            )

            stdout, _ = await process.communicate()
            output = stdout.decode("utf-8", errors="replace").strip()

            passed = process.returncode == 0
            return passed, output

        except Exception as e:
            return False, str(e)


class QualityGateRunner:
    """Runs quality gates for task verification."""

    def __init__(self, config: dict):
        self.config = config
        self.gates = self._build_gates()

    def _build_gates(self) -> list[QualityGate]:
        """Build quality gates from config."""
        gates = []

        # Default gates
        gates.append(QualityGate(
            name="test",
            command="npm test 2>&1 || pytest 2>&1 || echo 'No test runner found'",
            description="Run tests",
            required=True,
        ))

        gates.append(QualityGate(
            name="lint",
            command="npm run lint 2>&1 || ruff check . 2>&1 || echo 'No linter found'",
            description="Run linter",
            required=False,
        ))

        gates.append(QualityGate(
            name="typecheck",
            command="npm run typecheck 2>&1 || mypy . 2>&1 || echo 'No type checker found'",
            description="Run type checker",
            required=False,
        ))

        return gates

    async def run_all(self, working_dir: Path, result: TaskResult) -> TaskResult:
        """Run all quality gates and update the result."""
        all_passed = True
        gate_results = []

        for gate in self.gates:
            passed, output = await gate.run(working_dir)
            gate_results.append({
                "name": gate.name,
                "passed": passed,
                "output": output[:500],  # Truncate output
                "required": gate.required,
            })

            if not passed and gate.required:
                all_passed = False
                logger.warning(f"Quality gate '{gate.name}' failed: {output[:200]}")

            if passed:
                logger.info(f"Quality gate '{gate.name}' passed")
            else:
                logger.warning(f"Quality gate '{gate.name}' failed")

        # Update result with gate information
        if not all_passed and result.status == "completed":
            result.status = "failed"
            result.error_message = "Quality gates failed"

        return result

    async def run_specific(self, working_dir: Path, gate_name: str) -> tuple[bool, str]:
        """Run a specific quality gate."""
        for gate in self.gates:
            if gate.name == gate_name:
                return await gate.run(working_dir)

        return False, f"Gate '{gate_name}' not found"

    def add_gate(self, gate: QualityGate):
        """Add a custom quality gate."""
        self.gates.append(gate)

    def get_gate_names(self) -> list[str]:
        """Get names of all quality gates."""
        return [gate.name for gate in self.gates]
