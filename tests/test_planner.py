from src.planner.claude_adapter import get_claude_adapter
from src.planner.plan_builder import build_plan_from_response


def test_mock_planner_creates_steps():
    adapter = get_claude_adapter()
    resp = adapter.generate_plan("Create module and unit test")
    plan = build_plan_from_response(resp)

    assert plan.title is not None
    assert len(plan.steps) >= 2
    types = [s.type for s in plan.steps]
    assert "file_edit" in types
    assert "command" in types
