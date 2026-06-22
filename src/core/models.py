"""
Core data models for the Dombi Task Master system.
"""
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskPriority(str, Enum):
    """Task priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SubagentType(str, Enum):
    """Subagent type enumeration."""
    LOCAL = "local"
    REMOTE = "remote"
    SANDBOX = "sandbox"
    CODEX = "codex"


class Task(BaseModel):
    """Task model."""
    id: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    priority: TaskPriority = TaskPriority.MEDIUM
    subagent_type: SubagentType = SubagentType.LOCAL
    files_to_modify: List[str] = Field(default_factory=list)
    acceptance_criteria: List[str] = Field(default_factory=list)
    command: Optional[str] = None
    context: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    parent_task_id: Optional[str] = None
    dependencies: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True


class TaskResult(BaseModel):
    """Task execution result."""
    task_id: str
    status: TaskStatus
    exit_code: int
    duration_seconds: float
    output: str
    artifacts: List[str] = Field(default_factory=list)
    error_message: Optional[str] = None
    quality_gate_results: Dict[str, bool] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class Environment(BaseModel):
    """Execution environment model."""
    id: str
    name: str
    type: str  # "local", "remote", "sandbox"
    working_dir: Optional[str] = None
    env_vars: Dict[str, str] = Field(default_factory=dict)
    sandbox_config: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class AgentPlan(BaseModel):
    """Agent execution plan."""
    task_id: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    estimated_duration: float = 0.0
    risk_level: str = "low"
    requires_approval: bool = False
    context: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class ExecutionOutput(BaseModel):
    """Task execution output."""
    task_id: str
    stdout: str = ""
    stderr: str = ""
    exit_code: Optional[int] = None
    truncated: bool = False
    timestamp: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        use_enum_values = True


class SubagentConfig(BaseModel):
    """Subagent configuration."""
    type: SubagentType
    name: str
    description: str
    capabilities: List[str] = Field(default_factory=list)
    max_concurrent_tasks: int = 1
    timeout: int = 300
    config: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True


class SandboxStatus(BaseModel):
    """Sandbox status model."""
    id: str
    status: str  # "creating", "running", "stopped", "error"
    environment_id: str
    container_id: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_heartbeat: Optional[datetime] = None
    error_message: Optional[str] = None

    class Config:
        use_enum_values = True


class Hook(BaseModel):
    """Hook configuration."""
    name: str
    type: str  # "pre-commit", "post-commit", "pre-push", etc.
    command: str
    enabled: bool = True
    description: Optional[str] = None

    class Config:
        use_enum_values = True


class QualityGate(BaseModel):
    """Quality gate configuration."""
    name: str
    command: str
    description: str
    required: bool = True
    timeout: int = 60

    class Config:
        use_enum_values = True


class SystemConfig(BaseModel):
    """System configuration."""
    version: str = "1.0.0"
    storage_dir: str = ".task-master"
    log_level: str = "INFO"
    max_concurrent_tasks: int = 5
    default_priority: TaskPriority = TaskPriority.MEDIUM
    quality_gates: Dict[str, QualityGate] = Field(default_factory=dict)
    sandbox: Dict[str, Any] = Field(default_factory=dict)
    codex_integration: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        use_enum_values = True
