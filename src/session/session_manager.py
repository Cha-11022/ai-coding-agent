"""Session management for multi-turn conversations with project support."""

import json
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from ..config import SESSIONS_DIR


class ConversationTurn:
    """Represents a single turn in the conversation."""

    def __init__(self, turn_num: int, user_input: str):
        self.turn_num = turn_num
        self.user_input = user_input
        self.timestamp = datetime.now(timezone.utc).isoformat()
        self.ai_plan: Optional[Dict[str, Any]] = None
        self.execution_results: Optional[Dict[str, Any]] = None
        self.modified_files: List[str] = []
        self.deleted_files: List[str] = []
        self.errors: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "turn_num": self.turn_num,
            "user_input": self.user_input,
            "timestamp": self.timestamp,
            "ai_plan": self.ai_plan,
            "execution_results": self.execution_results,
            "modified_files": self.modified_files,
            "deleted_files": self.deleted_files,
            "errors": self.errors,
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ConversationTurn":
        turn = cls(data["turn_num"], data["user_input"])
        turn.timestamp = data.get("timestamp", turn.timestamp)
        turn.ai_plan = data.get("ai_plan")
        turn.execution_results = data.get("execution_results")
        turn.modified_files = data.get("modified_files", [])
        turn.deleted_files = data.get("deleted_files", [])
        turn.errors = data.get("errors", [])
        return turn


class SessionContext:
    """Maintains the state of a conversation session bound to a project directory."""

    def __init__(self, session_id: str, task_description: str, project_dir: str = "."):
        self.session_id = session_id
        self.task_description = task_description
        self.project_dir = os.path.abspath(project_dir)
        self.created_at = datetime.now(timezone.utc).isoformat()
        self.updated_at = self.created_at
        self.turns: List[ConversationTurn] = []
        # file_snapshots stores the LAST KNOWN GOOD content of files (full content)
        self.file_snapshots: Dict[str, str] = {}  # relative path -> content
        self.modified_files: Set[str] = set()  # Set of files modified in this session
        self.deleted_files: Set[str] = set()  # Set of files deleted in this session

    def add_turn(self, user_input: str) -> ConversationTurn:
        """Add a new turn to the conversation."""
        turn_num = len(self.turns) + 1
        turn = ConversationTurn(turn_num, user_input)
        self.turns.append(turn)
        self.updated_at = datetime.now(timezone.utc).isoformat()
        return turn

    def get_conversation_history(self) -> str:
        """Get formatted conversation history for context."""
        if not self.turns:
            return ""

        history = []
        for turn in self.turns:
            history.append(f"[Turn {turn.turn_num}] User: {turn.user_input}")
            if turn.ai_plan:
                steps_desc = ", ".join([s.get("description", "?") for s in turn.ai_plan.get("steps", [])])
                history.append(f"[Turn {turn.turn_num}] AI Plan: {steps_desc}")
            if turn.execution_results and turn.execution_results.get("status") == "success":
                history.append(f"[Turn {turn.turn_num}] Result: ✓ Success")
            elif turn.errors:
                history.append(f"[Turn {turn.turn_num}] Error: {'; '.join(turn.errors)}")

        return "\n".join(history)

    def take_file_snapshot(self, filepath: str, content: str) -> None:
        """Record the current content of a file (relative to project_dir)."""
        rel_path = self._to_relative(filepath)
        self.file_snapshots[rel_path] = content
        self.modified_files.add(rel_path)
        if rel_path in self.deleted_files:
            self.deleted_files.discard(rel_path)

    def mark_file_deleted(self, filepath: str) -> None:
        """Mark a file as deleted."""
        rel_path = self._to_relative(filepath)
        self.deleted_files.add(rel_path)
        if rel_path in self.modified_files:
            self.modified_files.discard(rel_path)
        if rel_path in self.file_snapshots:
            del self.file_snapshots[rel_path]

    def get_file_snapshot(self, filepath: str) -> Optional[str]:
        """Retrieve a saved file snapshot (accepts relative or absolute path)."""
        rel_path = self._to_relative(filepath)
        return self.file_snapshots.get(rel_path)

    def get_abs_path(self, rel_path: str) -> str:
        """Get absolute path from a relative path."""
        return os.path.normpath(os.path.join(self.project_dir, rel_path))

    def scan_project_files(self) -> Dict[str, str]:
        """Scan the project directory and return all existing file contents.
        Returns: dict of relative_path -> content for existing files.
        """
        project_files = {}
        project_root = Path(self.project_dir)
        if not project_root.exists():
            return project_files

        for file_path in project_root.rglob("*"):
            if file_path.is_file():
                # Skip hidden directories and common non-source dirs
                parts = file_path.relative_to(project_root).parts
                if any(p.startswith(".") for p in parts):
                    continue
                if any(p in ("node_modules", "__pycache__", ".venv", "env", "venv") for p in parts):
                    continue
                try:
                    rel = str(file_path.relative_to(project_root))
                    content = file_path.read_text(encoding="utf-8", errors="ignore")
                    project_files[rel] = content
                except Exception:
                    pass  # Skip binary files

        return project_files

    def get_project_summary(self) -> str:
        """Get a summary of all project files for AI context."""
        existing = self.scan_project_files()
        if not existing:
            return "(项目目录为空或无文件)"

        summary_lines = [f"项目目录: {self.project_dir}"]
        summary_lines.append(f"项目文件总数: {len(existing)}")
        summary_lines.append("")

        # Group by extension
        by_ext: Dict[str, List[str]] = {}
        for rel_path in sorted(existing.keys()):
            ext = os.path.splitext(rel_path)[1] or "(no ext)"
            by_ext.setdefault(ext, []).append(rel_path)

        for ext, files in sorted(by_ext.items()):
            summary_lines.append(f"  {ext} ({len(files)}个):")
            for f in files[:10]:  # Show first 10 per extension
                size = len(existing[f])
                summary_lines.append(f"    - {f} ({size} 字符)")
            if len(files) > 10:
                summary_lines.append(f"    ... 还有 {len(files)-10} 个文件")

        summary_lines.append("")
        summary_lines.append("=== 项目文件内容（供AI参考）===")
        for rel_path, content in existing.items():
            summary_lines.append(f"\n--- {rel_path} ---")
            summary_lines.append(content)

        return "\n".join(summary_lines)

    def _to_relative(self, filepath: str) -> str:
        """Convert a path to relative from project_dir if it's absolute."""
        abs_path = os.path.abspath(filepath)
        try:
            return os.path.relpath(abs_path, self.project_dir)
        except ValueError:
            return filepath

    def to_dict(self) -> Dict[str, Any]:
        return {
            "session_id": self.session_id,
            "task_description": self.task_description,
            "project_dir": self.project_dir,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "turns": [t.to_dict() for t in self.turns],
            "file_snapshots": self.file_snapshots,
            "modified_files": list(self.modified_files),
            "deleted_files": list(self.deleted_files),
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionContext":
        session = cls(
            session_id=data["session_id"],
            task_description=data.get("task_description", ""),
            project_dir=data.get("project_dir", "."),
        )
        session.created_at = data.get("created_at", session.created_at)
        session.updated_at = data.get("updated_at", session.created_at)
        session.turns = [ConversationTurn.from_dict(t) for t in data.get("turns", [])]
        session.file_snapshots = data.get("file_snapshots", {})
        session.modified_files = set(data.get("modified_files", []))
        session.deleted_files = set(data.get("deleted_files", []))
        return session


class SessionManager:
    """Manages session lifecycle and persistence."""

    def __init__(self):
        os.makedirs(SESSIONS_DIR, exist_ok=True)

    def create_session(self, session_id: str, task_description: str, project_dir: str = ".") -> SessionContext:
        """Create a new session context."""
        return SessionContext(session_id, task_description, project_dir)

    def save_session(self, context: SessionContext) -> None:
        """Persist session to disk."""
        session_file = os.path.join(SESSIONS_DIR, f"{context.session_id}.json")
        data = context.to_dict()
        with open(session_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def load_session(self, session_id: str) -> Optional[SessionContext]:
        """Load a session from disk with full restoration."""
        session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        if not os.path.exists(session_file):
            return None

        with open(session_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return SessionContext.from_dict(data)

    def list_sessions(self) -> List[Dict[str, Any]]:
        """List all saved sessions with summary info."""
        if not os.path.exists(SESSIONS_DIR):
            return []

        sessions = []
        for fname in sorted(os.listdir(SESSIONS_DIR)):
            if not fname.endswith(".json"):
                continue
            try:
                with open(os.path.join(SESSIONS_DIR, fname), "r", encoding="utf-8") as f:
                    data = json.load(f)
                session_id = data.get("session_id", fname.replace(".json", ""))
                sessions.append({
                    "session_id": session_id,
                    "task_description": data.get("task_description", ""),
                    "project_dir": data.get("project_dir", "."),
                    "created_at": data.get("created_at", ""),
                    "updated_at": data.get("updated_at", ""),
                    "turns": len(data.get("turns", [])),
                    "modified_files": len(data.get("modified_files", [])),
                })
            except Exception as e:
                # Skip corrupted session files
                continue

        # Sort by updated_at descending
        sessions.sort(key=lambda s: s.get("updated_at", ""), reverse=True)
        return sessions

    def delete_session(self, session_id: str) -> bool:
        """Delete a saved session."""
        session_file = os.path.join(SESSIONS_DIR, f"{session_id}.json")
        if not os.path.exists(session_file):
            return False
        os.remove(session_file)
        return True


# Global session manager instance
default_session_manager = SessionManager()