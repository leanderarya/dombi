"""
Task planning for the Dombi Task Master system.
"""
import logging
from typing import Any, Dict, List, Optional

from .models import Task, AgentPlan

logger = logging.getLogger(__name__)


class TaskPlanner:
    """Task planner for generating execution plans."""

    def __init__(self, config: Dict[str, Any]):
        self.config = config

    async def plan(self, task: Task, context: str) -> AgentPlan:
        """Generate an execution plan for a task."""
        logger.info(f"Planning task: {task.description[:50]}...")

        # Analyze task complexity
        complexity = self._analyze_complexity(task, context)

        # Generate steps
        steps = self._generate_steps(task, context, complexity)

        # Estimate duration
        estimated_duration = self._estimate_duration(steps, complexity)

        # Determine risk level
        risk_level = self._assess_risk(task, steps)

        # Determine if approval is required
        requires_approval = risk_level in ["high", "critical"]

        plan = AgentPlan(
            task_id=task.id,
            steps=steps,
            estimated_duration=estimated_duration,
            risk_level=risk_level,
            requires_approval=requires_approval,
            context=context,
        )

        logger.info(f"Generated plan with {len(steps)} steps, estimated {estimated_duration:.1f}s")
        return plan

    def _analyze_complexity(self, task: Task, context: str) -> str:
        """Analyze task complexity."""
        # Simple heuristic based on description length and files
        desc_length = len(task.description)
        num_files = len(task.files_to_modify)

        if desc_length > 500 or num_files > 5:
            return "high"
        elif desc_length > 200 or num_files > 2:
            return "medium"
        else:
            return "low"

    def _generate_steps(self, task: Task, context: str, complexity: str) -> List[Dict[str, Any]]:
        """Generate execution steps."""
        steps = []

        # Step 1: Analyze the task
        steps.append({
            "name": "analyze",
            "description": "Analyze the task and understand requirements",
            "type": "analysis",
            "estimated_duration": 5.0,
        })

        # Step 2: Gather context
        steps.append({
            "name": "gather_context",
            "description": "Gather relevant context from the codebase",
            "type": "context",
            "estimated_duration": 10.0,
        })

        # Step 3: Make changes
        if task.files_to_modify:
            for file_path in task.files_to_modify:
                steps.append({
                    "name": f"modify_{file_path}",
                    "description": f"Modify {file_path}",
                    "type": "modification",
                    "file": file_path,
                    "estimated_duration": 30.0,
                })
        else:
            steps.append({
                "name": "implement",
                "description": "Implement the required changes",
                "type": "implementation",
                "estimated_duration": 60.0,
            })

        # Step 4: Verify changes
        steps.append({
            "name": "verify",
            "description": "Verify changes work correctly",
            "type": "verification",
            "estimated_duration": 15.0,
        })

        # Step 5: Run quality gates
        steps.append({
            "name": "quality_gates",
            "description": "Run quality gates (tests, lint, type check)",
            "type": "quality",
            "estimated_duration": 30.0,
        })

        return steps

    def _estimate_duration(self, steps: List[Dict[str, Any]], complexity: str) -> float:
        """Estimate total duration."""
        base_duration = sum(step.get("estimated_duration", 0) for step in steps)

        # Apply complexity multiplier
        multiplier = {
            "low": 1.0,
            "medium": 1.5,
            "high": 2.0,
        }.get(complexity, 1.0)

        return base_duration * multiplier

    def _assess_risk(self, task: Task, steps: List[Dict[str, Any]]) -> str:
        """Assess task risk level."""
        # Check for high-risk indicators
        high_risk_indicators = [
            "delete" in task.description.lower(),
            "remove" in task.description.lower(),
            "refactor" in task.description.lower(),
            "database" in task.description.lower(),
            "migration" in task.description.lower(),
            len(task.files_to_modify) > 5,
        ]

        if any(high_risk_indicators):
            return "high"

        # Check for medium-risk indicators
        medium_risk_indicators = [
            "modify" in task.description.lower(),
            "update" in task.description.lower(),
            "change" in task.description.lower(),
            len(task.files_to_modify) > 2,
        ]

        if any(medium_risk_indicators):
            return "medium"

        return "low"
