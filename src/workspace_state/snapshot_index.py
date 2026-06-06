import json
from pathlib import Path
from typing import Dict, Any
from ..config import PROJECT_ROOT


INDEX_DIR = PROJECT_ROOT.parent / "workspace_state"
INDEX_FILE = INDEX_DIR / "snapshots.json"


def _ensure_dir():
    INDEX_DIR.mkdir(parents=True, exist_ok=True)


def load_index() -> Dict[str, Any]:
    _ensure_dir()
    if not INDEX_FILE.exists():
        return {}
    try:
        return json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_index(data: Dict[str, Any]) -> None:
    _ensure_dir()
    INDEX_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def register_snapshot(original: str, snapshot: str) -> None:
    idx = load_index()
    idx.setdefault("snapshots", []).append({"original": original, "snapshot": snapshot})
    save_index(idx)


def get_latest_snapshot(original: str) -> str | None:
    """Get the latest snapshot path for a given original file path."""
    idx = load_index()
    snapshots = idx.get("snapshots", [])
    # Search in reverse order to find the latest
    for entry in reversed(snapshots):
        if entry.get("original") == original:
            return entry.get("snapshot")
    return None
