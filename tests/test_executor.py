import os
from src.executor import file_ops


def test_write_and_delete_file(tmp_path):
    p = tmp_path / "sample.txt"
    content = "hello\n"
    # write
    file_ops.write_file(str(p), content)
    assert p.exists()
    with open(p, "r", encoding="utf-8") as f:
        data = f.read()
    assert data == content

    # delete
    deleted = file_ops.delete_file(str(p))
    assert deleted is True
    assert not p.exists()
