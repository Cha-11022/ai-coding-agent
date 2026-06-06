from src.executor.file_ops import write_file, snapshot_file
from src.workspace_state.snapshot_manager import restore_latest_snapshot
from pathlib import Path


def test_snapshot_and_restore(tmp_path):
    p = tmp_path / "data.txt"
    content_v1 = "version1\n"
    content_v2 = "version2\n"

    # create and write v1
    write_file(str(p), content_v1)
    # snapshot (simulates existing file)
    snap = snapshot_file(p)
    assert snap is not None

    # overwrite with v2
    write_file(str(p), content_v2)
    with open(p, "r", encoding="utf-8") as f:
        assert f.read() == content_v2

    # restore
    restored = restore_latest_snapshot(str(p))
    assert restored is True
    with open(p, "r", encoding="utf-8") as f:
        assert f.read() == content_v1
