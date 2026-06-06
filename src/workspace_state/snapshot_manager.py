from pathlib import Path
import shutil
from typing import Optional
from .snapshot_index import load_index
from ..logger.logger import default_logger


def find_latest_snapshot(original: str) -> Optional[str]:
    idx = load_index()
    snaps = idx.get("snapshots", [])
    # search in reverse for latest matching original
    for entry in reversed(snaps):
        if entry.get("original") == original:
            return entry.get("snapshot")
    return None


def restore_latest_snapshot(original: str) -> bool:
    snap = find_latest_snapshot(original)
    if not snap:
        default_logger.error("restore_failed_no_snapshot", original=original)
        return False
    try:
        orig_path = Path(original)
        snap_path = Path(snap)
        if not snap_path.exists():
            default_logger.error("restore_failed_snapshot_missing", original=original, snapshot=snap)
            return False
        # ensure parent exists
        orig_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(snap_path, orig_path)
        default_logger.info("restore_success", original=str(orig_path), snapshot=str(snap_path))
        return True
    except Exception as e:
        default_logger.error("restore_exception", original=original, error=str(e))
        return False
