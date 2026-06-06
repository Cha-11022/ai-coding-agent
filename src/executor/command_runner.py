import subprocess
from typing import Tuple
from ..logger.logger import default_logger


def run_command(command: str, timeout: int = 60) -> Tuple[int, str, str]:
    """Run a command using PowerShell on Windows and capture output."""
    default_logger.info("run_command_start", command=command)
    try:
        # Use PowerShell -Command
        completed = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        stdout = completed.stdout
        stderr = completed.stderr
        rc = completed.returncode
        default_logger.info("run_command_end", command=command, returncode=rc)
        if rc != 0:
            default_logger.error("command_failed", command=command, returncode=rc, stderr=stderr)
        return rc, stdout, stderr
    except subprocess.TimeoutExpired as e:
        default_logger.error("command_timeout", command=command)
        return -1, "", f"Timeout: {e}"
