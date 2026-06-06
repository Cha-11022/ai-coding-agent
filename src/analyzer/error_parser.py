from typing import Dict


def parse_command_error(command: str, stdout: str, stderr: str, returncode: int) -> Dict:
    """Extract a minimal error context from command output."""
    # Very small parser that looks for pytest failures or module errors
    ctx = {
        "command": command,
        "returncode": returncode,
        "summary": None,
        "files": [],
        "stderr": stderr,
        "stdout": stdout,
    }

    if "ModuleNotFoundError" in stderr:
        # try to extract missing module name
        for line in stderr.splitlines():
            if "ModuleNotFoundError" in line:
                ctx["summary"] = line.strip()
                break

    if "FAILED" in stdout or "FAILED" in stderr or "assert" in stderr:
        ctx["summary"] = "test_failure"

    # naive extraction of file references
    for line in (stderr + "\n" + stdout).splitlines():
        if ".py" in line and ":" in line:
            # try to parse pattern file.py:lineno
            parts = line.strip().split()
            for p in parts:
                if p.endswith(".py"):
                    ctx["files"].append(p)
    return ctx
