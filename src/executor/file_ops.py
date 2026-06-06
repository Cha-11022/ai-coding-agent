from pathlib import Path
from typing import Union
from ..config import SNAPSHOT_DIR
from ..logger.logger import default_logger
import shutil
from ..workspace_state import snapshot_index


def ensure_snapshot_dir():
    Path(SNAPSHOT_DIR).mkdir(parents=True, exist_ok=True)


def snapshot_file(path: Union[str, Path]):
    p = Path(path)
    if not p.exists():
        return None
    ensure_snapshot_dir()
    dest = Path(SNAPSHOT_DIR) / (p.name + ".bak")
    shutil.copy2(p, dest)
    default_logger.info("snapshot_created", file=str(p), snapshot=str(dest))
    try:
        snapshot_index.register_snapshot(str(p), str(dest))
    except Exception:
        # don't fail on snapshot index issues
        default_logger.error("snapshot_index_failed", file=str(p), snapshot=str(dest))
    return dest


def write_file(path: Union[str, Path], content: str) -> None:
    p = Path(path)
    if p.exists():
        snapshot_file(p)
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    default_logger.info("file_written", file=str(p))


def delete_file(path: Union[str, Path]) -> bool:
    p = Path(path)
    if not p.exists():
        return False
    snapshot_file(p)
    p.unlink()
    default_logger.info("file_deleted", file=str(p))
    return True
