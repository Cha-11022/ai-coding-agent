import json
from pathlib import Path
from typing import Dict, Any
from ..config import PROJECT_ROOT


PERM_DIR = PROJECT_ROOT.parent / "workspace_state"
PERM_FILE = PERM_DIR / "permissions.json"


def _ensure_dir():
    PERM_DIR.mkdir(parents=True, exist_ok=True)


def load_permissions() -> Dict[str, Any]:
    _ensure_dir()
    if not PERM_FILE.exists():
        return {}
    try:
        return json.loads(PERM_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_permissions(data: Dict[str, Any]) -> None:
    _ensure_dir()
    PERM_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def set_permission(key: str, value: Any) -> None:
    perms = load_permissions()
    perms[key] = value
    save_permissions(perms)


def get_permission(key: str, default=None):
    perms = load_permissions()
    return perms.get(key, default)


def delete_permission(key: str) -> None:
    perms = load_permissions()
    if key in perms:
        del perms[key]
        save_permissions(perms)
