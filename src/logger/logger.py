import json
from datetime import datetime
from pathlib import Path
from typing import Any
from ..config import LOG_DIR


class Logger:
    def __init__(self, log_dir: Path | str = LOG_DIR):
        self.log_dir = Path(log_dir)
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.log_file = self.log_dir / "events.jsonl"
        self.audit_file = self.log_dir / "audit.jsonl"

    def _write(self, path: Path, obj: dict):
        obj["timestamp"] = datetime.utcnow().isoformat() + "Z"
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(obj, ensure_ascii=False) + "\n")

    def info(self, message: str, **metadata: Any):
        self._write(self.log_file, {"level": "info", "message": message, "metadata": metadata})

    def error(self, message: str, **metadata: Any):
        self._write(self.log_file, {"level": "error", "message": message, "metadata": metadata})

    def audit(self, message: str, **metadata: Any):
        self._write(self.audit_file, {"level": "audit", "message": message, "metadata": metadata})


default_logger = Logger()
