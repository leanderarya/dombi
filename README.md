# Dombi Task Master

A local-first, asynchronous task orchestration system for autonomous code agents.

## Features

- **Task Management**: Create, update, and track tasks with full lifecycle management
- **Execution Planning**: Automatic plan generation with risk assessment
- **Sandbox Execution**: Isolated execution environments using Docker
- **Quality Gates**: Configurable quality checks (tests, lint, type checking)
- **Terminal UI**: Rich terminal interface for task monitoring
- **MCP Integration**: Model Context Protocol server for Codex integration
- **Local-First**: All data stored locally, no external dependencies

## Quick Start

### 1. Initialize Task Master

```bash
python -m src.cli.main init
```

### 2. Create a Task

```bash
python -m src.cli.main create "Fix the login bug" --priority high
```

### 3. List Tasks

```bash
python -m src.cli.main list
```

### 4. View Task Details

```bash
python -m src.cli.main show <task-id>
```

### 5. Check System Status

```bash
python -m src.cli.main status
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `init` | Initialize Task Master in current repository |
| `create` | Create a new task |
| `list` | List all tasks |
| `show` | Show task details |
| `run` | Run a task |
| `cancel` | Cancel a running task |
| `status` | Show system status |
| `tui` | Launch terminal UI |

## Architecture

### Core Components

- **Models** (`src/core/models.py`): Data models for tasks, results, environments
- **Storage** (`src/core/storage.py`): Local state storage with JSON files
- **Planner** (`src/core/planner.py`): Task planning and risk assessment
- **Executor** (`src/cli/executor.py`): Task execution in sandbox environments
- **Quality Gates** (`src/cli/quality_gates.py`): Configurable quality checks
- **Context Gatherer** (`src/cli/context_gatherer.py`): Repository context collection

### Sandbox System

- **Manager** (`src/sandbox/manager.py`): Sandbox lifecycle management
- **Docker Runtime** (`src/sandbox/docker_runtime.py`): Docker-based execution

### User Interfaces

- **CLI** (`src/cli/main.py`): Command-line interface
- **TUI** (`src/cli/tui/`): Terminal user interface using Textual
- **MCP Server** (`src/mcp/server.py`): Model Context Protocol integration

## Configuration

Task Master uses a JSON configuration file at `.task-master/config.json`:

```json
{
  "version": "1.0.0",
  "storage_dir": ".task-master",
  "log_level": "INFO",
  "max_concurrent_tasks": 5,
  "default_priority": "medium",
  "quality_gates": {
    "test": {"required": true},
    "lint": {"required": false},
    "typecheck": {"required": false}
  }
}
```

## Quality Gates

Quality gates are configurable checks that run after task execution:

- **test**: Run test suite (required by default)
- **lint**: Run linter (optional)
- **typecheck**: Run type checker (optional)
- **security**: Run security checks (custom)

## Development

### Running Tests

```bash
python -c "
import asyncio
from src.core.models import Task
from src.core.storage import StateStore

async def test():
    store = StateStore('.test')
    task = Task(id='test', description='Test task')
    await store.store_task(task)
    retrieved = await store.get_task('test')
    assert retrieved is not None
    print('✅ Tests passed')

asyncio.run(test())
"
```

### Adding Custom Quality Gates

```python
from src.cli.quality_gates import QualityGate, QualityGateRunner

gate = QualityGate(
    name='custom',
    command='echo "Custom check"',
    description='Custom quality check',
    required=False,
)

runner = QualityGateRunner({})
runner.add_gate(gate)
```

## License

MIT License
