import json
from src.auth.auth_manager import AuthManager
from src.workspace_state import permissions
from pathlib import Path


def test_permission_save_and_revoke(tmp_path, monkeypatch):
    am = AuthManager()
    step = {"type": "file_edit", "description": "Delete important file", "danger_level": 2}

    # mock input to approve permanently
    monkeypatch.setattr("builtins.input", lambda prompt="": "y permanent")
    approved = am.request_approval(step)
    assert approved is True

    key = am._key_for_step(step)
    # check persisted
    val = permissions.get_permission(key)
    assert val is True

    # revoke
    am.revoke_permission(key)
    assert permissions.get_permission(key) is None
