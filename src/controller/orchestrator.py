from typing import Any
from ..planner.claude_adapter import get_claude_adapter
from ..planner.plan_builder import build_plan_from_response
from ..auth.auth_manager import AuthManager
from ..executor import file_ops, command_runner
from ..logger.logger import default_logger
from ..analyzer import error_parser, repair_suggester
from ..workspace_state import snapshot_manager
from ..workspace_state import snapshot_index
from datetime import datetime, timezone


class Orchestrator:
    def __init__(self):
        self.adapter = get_claude_adapter()
        self.auth = AuthManager()

    def run_task(self, natural_language: str):
        default_logger.info("task_started", task=natural_language)
        response = self.adapter.generate_plan(natural_language)
        plan = build_plan_from_response(response)

        # 展示计划
        print("生成的执行计划：")
        for s in plan.steps:
            print(f"- [{s.id}] {s.type}: {s.description}")

        ok = input("确认执行计划吗? [y/N] ").strip().lower() in ("y", "yes")
        if not ok:
            default_logger.info("task_aborted_by_user", task=plan.task_id)
            print("已中止")
            return


        # 执行步骤；跟踪已修改的文件以便回滚
        modified_files = []
        for step in plan.steps:
            default_logger.info("executing_step", step_id=step.id, type=step.type)
            # 危险步骤需要授权
            if step.danger_level and step.danger_level > 0:
                approved = self.auth.request_approval(step.__dict__)
                if not approved:
                    print(f"步骤 {step.id} 被用户拒绝，跳过。")
                    default_logger.info("step_skipped_unauthorized", step_id=step.id)
                    continue

            if step.type == "file_edit":
                for idx, f in enumerate(step.files):
                    content = step.content or ""
                    file_ops.write_file(f, content)
                    modified_files.append(f)
                    print(f"已写入文件: {f}")
            elif step.type == "command":
                rc, out, err = command_runner.run_command(step.command or "", timeout=60)
                print(out)
                if rc != 0:
                    print("命令执行失败:", err)
                    default_logger.error("step_command_failed", step_id=step.id, stderr=err)
                    # Analyze error and suggest repair
                    ctx = error_parser.parse_command_error(step.command or "", out or "", err or "", rc)
                    suggestion = repair_suggester.suggest_fix(ctx)
                    default_logger.info("repair_suggestion", suggestion=suggestion)
                    if suggestion.get("type") == "file_edit":
                        print("建议的修复:", suggestion.get("note"))
                        print("文件:", suggestion.get("file"))
                        do_apply = input("应用建议的修复吗? [y/N] ").strip().lower() in ("y", "yes")
                        default_logger.audit("apply_fix_prompt", suggestion=suggestion, applied=do_apply)
                        if do_apply:
                            file_ops.write_file(suggestion.get("file"), suggestion.get("content") or "")
                            modified_files.append(suggestion.get("file"))
                            print("已应用修复，重新运行命令...")
                            rc2, out2, err2 = command_runner.run_command(step.command or "", timeout=60)
                            print(out2)
                            if rc2 != 0:
                                print("修复后命令仍然失败:", err2)
                                default_logger.error("step_command_failed_after_fix", step_id=step.id, stderr=err2)
                                # offer rollback
                                # Show snapshot info before rollback
                                info_lines = []
                                for mf in modified_files:
                                    snap = snapshot_manager.find_latest_snapshot(mf)
                                    if snap:
                                        try:
                                            ts = datetime.fromtimestamp(Path(snap).stat().st_mtime, tz=timezone.utc).isoformat()
                                        except Exception:
                                            ts = "unknown"
                                        info_lines.append(f"{mf} <- {snap} (snapshot_time={ts})")
                                    else:
                                        info_lines.append(f"{mf} <- (no snapshot found)")
                                print("可以回滚的文件：")
                                for l in info_lines:
                                    print(" - ", l)
                                do_rollback = input("回滚这些修改过的文件吗? [y/N] ").strip().lower() in ("y", "yes")
                                default_logger.audit("rollback_prompt", step_id=step.id, rollback=do_rollback, files=modified_files)
                                if do_rollback:
                                    for mf in modified_files:
                                        ok = snapshot_manager.restore_latest_snapshot(mf)
                                        default_logger.audit("rollback_action", file=mf, restored=ok)
                                        print(f"已回滚 {mf}: {ok}")
                            else:
                                default_logger.info("step_command_succeeded_after_fix", step_id=step.id)
                    else:
                        print("没有可用的自动修复方案。")
                        # 显示快照信息然后询问是否回滚
                        info_lines = []
                        for mf in modified_files:
                            snap = snapshot_manager.find_latest_snapshot(mf)
                            if snap:
                                try:
                                    ts = datetime.fromtimestamp(Path(snap).stat().st_mtime, tz=timezone.utc).isoformat()
                                except Exception:
                                    ts = "unknown"
                                info_lines.append(f"{mf} <- {snap} (snapshot_time={ts})")
                            else:
                                info_lines.append(f"{mf} <- (no snapshot found)")
                        print("可以回滚的文件：")
                        for l in info_lines:
                            print(" - ", l)
                        do_rollback = input("回滚这些修改过的文件吗? [y/N] ").strip().lower() in ("y", "yes")
                        default_logger.audit("rollback_prompt_no_fix", step_id=step.id, rollback=do_rollback, files=modified_files)
                        if do_rollback:
                            for mf in modified_files:
                                ok = snapshot_manager.restore_latest_snapshot(mf)
                                default_logger.audit("rollback_action", file=mf, restored=ok)
                                print(f"已回滚 {mf}: {ok}")
            else:
                print(f"未知的步骤类型: {step.type}")

        default_logger.info("task_completed", task=plan.task_id)
        print("任务已完成")
