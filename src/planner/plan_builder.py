from typing import Dict, List
from ..controller.task_state import TaskPlan, PlanStep, new_task_id


def build_plan_from_response(response: Dict) -> TaskPlan:
    title = response.get("title", "Unnamed Task")
    ai_response = response.get("response", "")
    steps_raw: List[Dict] = response.get("steps", [])
    steps = []
    for i, s in enumerate(steps_raw):
        step = PlanStep(
            id=f"step-{i+1}",
            type=s.get("type", "command"),
            description=s.get("description", ""),
            files=s.get("files", []),
            content=s.get("content"),
            command=s.get("command"),
            danger_level=s.get("danger_level", 0),
        )
        steps.append(step)

    return TaskPlan(task_id=new_task_id(), title=title, response=ai_response, steps=steps)
