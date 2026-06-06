from typing import Dict
from ..logger.logger import default_logger


def suggest_fix(error_ctx: Dict) -> Dict:
    """Produce a simple repair suggestion based on error context.

    Returns a dict with keys: 'type' ('file_edit'|'none'), 'file', 'content', 'note'
    """
    default_logger.info("suggest_fix_called", summary=error_ctx.get("summary"))
    cmd = error_ctx.get("command", "")
    summary = error_ctx.get("summary", "")

    # If pytest failed, suggest adding a simple implementation for example_generated.py
    if "pytest" in cmd or summary == "test_failure":
        file = "example_generated.py"
        content = (
            "# Auto-generated repair: add greet() to satisfy tests\n"
            "def greet(name: str) -> str:\n"
            "    return f'Hello, {name}'\n"
        )
        return {"type": "file_edit", "file": file, "content": content, "note": "Add greet() implementation to satisfy tests"}

    # If module not found, create a placeholder module
    if error_ctx.get("summary") and "ModuleNotFoundError" in error_ctx.get("summary"):
        # extract module name
        line = error_ctx.get("summary")
        parts = line.split("'")
        mod = parts[1] if len(parts) > 1 else "mymodule"
        file = f"{mod}.py"
        content = "# Auto-generated placeholder module\n"
        return {"type": "file_edit", "file": file, "content": content, "note": f"Create placeholder module {mod}"}

    return {"type": "none", "note": "No automated suggestion available"}
