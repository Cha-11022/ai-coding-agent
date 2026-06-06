from dataclasses import dataclass, field
from typing import List, Optional
import uuid


@dataclass
class PlanStep:
    id: str
    type: str  # 'file_edit' or 'command'
    description: str
    files: List[str] = field(default_factory=list)
    content: Optional[str] = None
    command: Optional[str] = None
    danger_level: int = 0


@dataclass
class TaskPlan:
    task_id: str
    title: str
    response: str = ""
    steps: List[PlanStep] = field(default_factory=list)


def new_task_id() -> str:
    return uuid.uuid4().hex
