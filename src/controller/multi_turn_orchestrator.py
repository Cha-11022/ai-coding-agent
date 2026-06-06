"""Multi-turn conversation orchestrator with project support."""

import os
from typing import Any, Dict, List, Optional

from ..planner.claude_adapter import get_claude_adapter
from ..planner.plan_builder import build_plan_from_response
from ..auth.auth_manager import AuthManager
from ..executor import file_ops, command_runner
from ..executor.file_diff import FileDiffParser, FileModifier
from ..logger.logger import default_logger
from ..analyzer import error_parser, repair_suggester
from ..workspace_state import snapshot_manager
from ..workspace_state import snapshot_index
from ..session.session_manager import SessionContext, ConversationTurn
from datetime import datetime, timezone


class MultiTurnOrchestrator:
    """Orchestrator that supports multi-turn conversations with incremental modifications
    on a project directory."""

    def __init__(self, session: SessionContext):
        self.session = session
        self.adapter = get_claude_adapter()
        self.auth = AuthManager()
        # Current state of files in memory (relative paths -> content)
        self.file_state: Dict[str, str] = {}

        # Initialize file_state from existing project files
        self._load_project_files()

    def _load_project_files(self):
        """Load existing project files and session snapshots into file_state."""
        # First load session snapshots (these take precedence - they reflect AI-modified state)
        for rel_path, content in self.session.file_snapshots.items():
            self.file_state[rel_path] = content

        # Then scan project directory for files not yet in session
        project_files = self.session.scan_project_files()
        for rel_path, content in project_files.items():
            if rel_path not in self.file_state:
                self.file_state[rel_path] = content

    def run_conversation(self):
        """Main multi-turn conversation loop."""
        print(f"\n{'='*60}")
        print(f"项目: {self.session.project_dir}")
        print(f"任务: {self.session.task_description}")
        print(f"会话 ID: {self.session.session_id}")
        print(f"{'='*60}")
        print("提示: 输入任务描述、修改建议，或输入:")
        print("  'exit'   - 退出并保存")
        print("  'status' - 查看文件状态")
        print("  'undo'   - 撤销上一轮操作")
        print("  'list'   - 查看项目文件列表")
        print(f"{'='*60}")

        # Show project overview on start
        self._show_project_overview()

        turn_count = len(self.session.turns)  # Continue from existing turns if resuming
        while True:
            user_input = input(f"\n[轮 {turn_count + 1}] 请输入: ").strip()

            if user_input.lower() == "exit":
                print("对话已结束。")
                break
            elif user_input.lower() == "status":
                self._show_file_status()
                continue
            elif user_input.lower() == "list":
                self._show_project_file_list()
                continue
            elif user_input.lower() == "undo":
                self._undo_last_turn()
                continue
            elif not user_input:
                continue

            # Execute one turn of conversation
            turn_count += 1
            self._execute_turn(user_input)

        print(f"\n会话已保存 (ID: {self.session.session_id})")

    def _execute_turn(self, user_input: str):
        """Execute a single turn of the conversation."""
        # Add turn to session
        turn = self.session.add_turn(user_input)

        default_logger.info("turn_started", turn_num=turn.turn_num, input=user_input)

        # Build context for AI (includes conversation history + all project files)
        context = self._build_context()

        # Generate plan
        try:
            response = self.adapter.generate_plan(user_input, context)
            turn.ai_plan = response
            plan = build_plan_from_response(response)
        except Exception as e:
            turn.errors.append(str(e))
            default_logger.error("plan_generation_failed", error=str(e))
            print(f"[ERROR] 计划生成失败: {e}")
            return

        # Show AI's natural language response
        ai_response = response.get("response", "")
        if ai_response:
            print(f"\n🤖 {ai_response}")

        # Show plan
        if plan.steps:
            print("\n📋 执行计划:")
            for s in plan.steps:
                danger_tag = " [!]" if s.danger_level and s.danger_level > 0 else ""
                print(f"  [{s.id}] {s.type}: {s.description}{danger_tag}")

            ok = input("\n确认执行? [y/N] ").strip().lower() in ("y", "yes")
        else:
            print("\n✅ 无需执行操作。")
            return
        if not ok:
            default_logger.info("turn_cancelled", turn_num=turn.turn_num)
            print("已取消。")
            # Remove the empty turn
            self.session.turns.pop()
            return

        # Execute plan
        modified_files = []
        deleted_files = []
        for step in plan.steps:
            default_logger.info("executing_step", step_id=step.id, type=step.type)

            # Authorization check for dangerous steps
            if step.danger_level and step.danger_level > 0:
                approved = self.auth.request_approval(step.__dict__)
                if not approved:
                    print(f"  [x] 步骤 {step.id} 被拒绝，跳过。")
                    default_logger.info("step_skipped_unauthorized", step_id=step.id)
                    continue

            try:
                if step.type == "file_edit":
                    # Check if it's a delete operation
                    operation = getattr(step, 'operation', None) or step.__dict__.get('operation', '')
                    if operation == "delete" or step.content is None:
                        for f in step.files:
                            abs_path = self.session.get_abs_path(f)
                            if os.path.exists(abs_path):
                                # Save snapshot before deleting
                                self.session.take_file_snapshot(f, self.file_state.get(f, ""))
                                file_ops.delete_file(abs_path)
                                self.session.mark_file_deleted(f)
                                if f in self.file_state:
                                    del self.file_state[f]
                                deleted_files.append(f)
                                print(f"  [OK] 已删除: {f}")
                    else:
                        content = step.content or ""
                        for f in step.files:
                            abs_path = self.session.get_abs_path(f)
                            file_ops.write_file(abs_path, content)
                            self.file_state[f] = content
                            self.session.take_file_snapshot(f, content)
                            modified_files.append(f)
                            print(f"  [OK] 已写入: {f}")

                elif step.type == "command":
                    rc, out, err = command_runner.run_command(step.command or "", timeout=60)
                    if out:
                        # Show only last 30 lines of output to avoid clutter
                        out_lines = out.strip().split("\n")
                        if len(out_lines) > 30:
                            print(f"  [OK] 命令输出 ({len(out_lines)} 行，显示最后 30 行):")
                            print("\n".join(out_lines[-30:]))
                        else:
                            print(f"  [OK] 命令输出:\n{out.strip()}")
                    if rc != 0:
                        print(f"  [FAIL] 命令失败 (rc={rc}): {err[:500] if err else ''}")
                        turn.errors.append(err)
                        default_logger.error("command_failed", step_id=step.id, rc=rc, stderr=err)

            except Exception as e:
                turn.errors.append(str(e))
                default_logger.error("step_execution_failed", step_id=step.id, error=str(e))
                print(f"  [FAIL] 执行失败: {e}")

        turn.modified_files = modified_files
        turn.deleted_files = deleted_files
        turn.execution_results = {
            "status": "success" if not turn.errors else "partial_failure",
            "modified_files": modified_files,
            "deleted_files": deleted_files,
        }

        # Print summary
        summary_parts = []
        if modified_files:
            summary_parts.append(f"修改了 {len(modified_files)} 个文件")
        if deleted_files:
            summary_parts.append(f"删除了 {len(deleted_files)} 个文件")
        if turn.errors:
            summary_parts.append(f"发生了 {len(turn.errors)} 个错误")

        default_logger.info("turn_completed", turn_num=turn.turn_num,
                           files_modified=len(modified_files), files_deleted=len(deleted_files))
        print(f"\n[OK] 轮 {turn.turn_num} 完成 ({', '.join(summary_parts) if summary_parts else '无变更'})")

    def _build_context(self) -> Dict[str, Any]:
        """Build AI context from session state and project files."""
        # Get the project summary (all existing files)
        project_summary = self.session.get_project_summary()

        context = {
            "conversation_history": self.session.get_conversation_history(),
            "file_snapshots": self.file_state,
            "project_summary": project_summary,
            "project_dir": self.session.project_dir,
        }
        return context

    def _show_project_overview(self):
        """Show an overview of the project at conversation start."""
        # Show session info if resuming
        if len(self.session.turns) > 0:
            print(f"\n[恢复对话] - 已有 {len(self.session.turns)} 轮历史记录")

        # Count files in project
        project_files = self.session.scan_project_files()
        if project_files:
            print(f"\n[项目文件] ({len(project_files)} 个文件):")
            by_ext: Dict[str, int] = {}
            for rel_path in project_files:
                ext = os.path.splitext(rel_path)[1] or "(no ext)"
                by_ext[ext] = by_ext.get(ext, 0) + 1
            for ext, count in sorted(by_ext.items()):
                print(f"    {ext}: {count} 个文件")
        else:
            print("\n[项目目录为空]，将创建新文件。")

    def _show_file_status(self):
        """Show current file state from this session."""
        if not self.file_state and not self.session.deleted_files:
            print("还未创建或修改任何文件。")
            return

        print("\n[当前会话文件状态]:")

        # Show session-modified files
        if self.session.modified_files:
            print(f"\n  [已修改/创建的文件] ({len(self.session.modified_files)}):")
            for rel_path in sorted(self.session.modified_files):
                content = self.file_state.get(rel_path, "")
                lines = len(content.split("\n")) if content else 0
                print(f"    {rel_path} ({lines} 行)")

        # Show deleted files
        if self.session.deleted_files:
            print(f"\n  [已删除的文件] ({len(self.session.deleted_files)}):")
            for rel_path in sorted(self.session.deleted_files):
                print(f"    {rel_path}")

        # Show project files not modified in session
        project_files = self.session.scan_project_files()
        untouched = [f for f in project_files if f not in self.session.modified_files
                     and f not in self.session.deleted_files]
        if untouched:
            print(f"\n  [项目已有文件（未修改）] ({len(untouched)}):")
            for rel_path in sorted(untouched)[:15]:
                print(f"    {rel_path}")
            if len(untouched) > 15:
                print(f"    ... 还有 {len(untouched) - 15} 个文件（使用 'list' 查看全部）")

    def _show_project_file_list(self):
        """Show all files in the project directory."""
        project_files = self.session.scan_project_files()
        if not project_files:
            print("项目目录为空。")
            return

        print(f"\n[{self.session.project_dir} 中的文件] ({len(project_files)} 个):")
        for rel_path in sorted(project_files.keys()):
            marker = ""
            if rel_path in self.session.modified_files:
                marker = " [修改]"
            elif rel_path in self.session.deleted_files:
                marker = " [删除]"
            print(f"    {rel_path}{marker}")

    def _undo_last_turn(self):
        """Undo the last turn by restoring files from snapshots."""
        if len(self.session.turns) == 0:
            print("没有可撤销的操作。")
            return

        last_turn = self.session.turns[-1]
        if not last_turn.modified_files and not last_turn.deleted_files:
            # Empty turn, just remove it
            self.session.turns.pop()
            print("已撤销（空操作）。")
            return

        print(f"\n正在撤销第 {last_turn.turn_num} 轮操作...")

        # Restore modified files to previous state
        for rel_path in last_turn.modified_files:
            abs_path = self.session.get_abs_path(rel_path)
            # Check if there's a snapshot in the snapshot system
            snapshot_path = snapshot_index.get_latest_snapshot(abs_path)
            if snapshot_path and os.path.exists(snapshot_path):
                # Restore from filesystem snapshot
                import shutil
                shutil.copy2(snapshot_path, abs_path)
                print(f"  [恢复] 已恢复: {rel_path} (从快照)")
            else:
                # If no snapshot, just note it
                print(f"  [WARN] 无法恢复 {rel_path} (无可用快照)")

            # Update file state from actual file content
            try:
                with open(abs_path, "r", encoding="utf-8") as f:
                    self.file_state[rel_path] = f.read()
                self.session.take_file_snapshot(rel_path, self.file_state[rel_path])
            except (FileNotFoundError, IOError):
                if rel_path in self.file_state:
                    del self.file_state[rel_path]

        # Restore deleted files from snapshots
        for rel_path in last_turn.deleted_files:
            snapshot_content = self.session.get_file_snapshot(rel_path)
            if snapshot_content is not None:
                abs_path = self.session.get_abs_path(rel_path)
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                with open(abs_path, "w", encoding="utf-8") as f:
                    f.write(snapshot_content)
                self.file_state[rel_path] = snapshot_content
                self.session.take_file_snapshot(rel_path, snapshot_content)
                print(f"  [恢复] 已恢复已删除的文件: {rel_path}")
            else:
                print(f"  [WARN] 无法恢复已删除的文件 {rel_path} (无内容快照)")

        # Remove the last turn from session
        self.session.turns.pop()
        print(f"[OK] 已撤销第 {last_turn.turn_num} 轮操作。")