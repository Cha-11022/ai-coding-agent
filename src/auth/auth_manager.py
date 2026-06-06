from typing import Dict, Any
from ..logger.logger import default_logger
from ..workspace_state import permissions


class AuthManager:
    def __init__(self):
        # load remembered permissions (permanent)
        self._session = {}
        self._permanent = permissions.load_permissions()

    def _key_for_step(self, step: Dict[str, Any]) -> str:
        # simple key: action-description
        return f"{step.get('type')}:{step.get('description')}"

    def request_approval(self, step: Dict[str, Any]) -> bool:
        key = self._key_for_step(step)
        # 检查会话记忆
        if key in self._session:
            default_logger.audit("approval_from_session", step=step, approved=self._session[key])
            return self._session[key]

        # 检查永久记忆
        if key in self._permanent:
            approved = self._permanent[key]
            default_logger.audit("approval_from_permanent", step=step, approved=approved)
            return approved

        desc = step.get("description", "无描述")
        danger = step.get("danger_level", 0)
        msg = f"需要授权的操作: {desc} (危险等级={danger})\n同意? [y/N] (你可以输入 'y permanent' 表示永久记忆此决定) "
        default_logger.audit("request_approval", step=step)
        ans = input(msg).strip().lower()
        approved = ans.startswith("y")

        # 解析记忆标记
        remember_perm = False
        if approved and "permanent" in ans:
            remember_perm = True

        # 存储到会话
        self._session[key] = approved
        if remember_perm:
            self._permanent[key] = approved
            permissions.set_permission(key, approved)
            default_logger.audit("permission_saved", key=key, approved=approved)

        default_logger.audit("approval_result", step=step, approved=approved)
        return approved

    def revoke_permission(self, key: str) -> None:
        # 撤销永久授权
        permissions.delete_permission(key)
        if key in self._permanent:
            del self._permanent[key]
        if key in self._session:
            del self._session[key]
        default_logger.audit("permission_revoked", key=key)

    def list_permissions(self) -> Dict[str, Any]:
        data = {"session": dict(self._session), "permanent": dict(self._permanent)}
        return data
