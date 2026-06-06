"""Multi-turn conversation CLI with project support."""

import os
import uuid
from getpass import getpass

from ..config import API_PROVIDER, CLAUDE_API_KEY, DEEPSEEK_API_KEY, USE_MOCK_CLAUDE, SESSIONS_DIR
from ..controller.multi_turn_orchestrator import MultiTurnOrchestrator
from ..session.session_manager import SessionContext, default_session_manager
from ..logger import default_logger


def main_multiturn(session: SessionContext):
    """Start a multi-turn conversation with the given session context."""
    if not USE_MOCK_CLAUDE:
        provider = API_PROVIDER.lower()
        if provider == "deepseek":
            key_name = "DEEPSEEK_API_KEY"
            env_key = DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY")
        else:
            key_name = "CLAUDE_API_KEY"
            env_key = CLAUDE_API_KEY or os.getenv("CLAUDE_API_KEY")

        if not env_key:
            print(f"未检测到 {key_name}。请在运行时输入您的 {provider.title()} API Key。")
            api_key = getpass(f"请输入 {provider.title()} API Key: ").strip()
            if not api_key:
                print("未输入 API Key，程序退出。")
                return
            os.environ[key_name] = api_key

    mode = "Mock Claude" if USE_MOCK_CLAUDE else f"{API_PROVIDER.title()} API"
    print(f"\n{'='*60}")
    print(f"Claude AI Coding Agent - 多轮对话模式 ({mode})")
    print(f"{'='*60}")

    default_logger.info("multiturn_session_started",
                       session_id=session.session_id,
                       task=session.task_description,
                       project_dir=session.project_dir)

    # Run multi-turn conversation
    try:
        orchestrator = MultiTurnOrchestrator(session)
        orchestrator.run_conversation()
    except Exception as e:
        default_logger.error("multiturn_session_error", session_id=session.session_id, error=str(e))
        print(f"错误: {e}")
    finally:
        # Save session
        default_session_manager.save_session(session)
        default_logger.info("session_saved", session_id=session.session_id, turns=len(session.turns))
        print(f"\n✅ 会话已保存 (ID: {session.session_id})")


def start_new_session():
    """Create and start a new session."""
    # Get project directory
    default_project = os.getcwd()
    print(f"\n📁 项目目录 (默认: {default_project}):")
    project_input = input("> ").strip()
    project_dir = project_input if project_input else default_project

    if not os.path.exists(project_dir):
        print(f"⚠️  目录不存在，将创建: {project_dir}")
        os.makedirs(project_dir, exist_ok=True)

    # Get task description
    task_description = input("\n📝 请描述你的编程任务 (可以很简单，稍后可以逐步完善):\n> ").strip()
    if not task_description:
        print("任务描述不能为空。")
        return None

    # Create session
    session_id = str(uuid.uuid4())[:8]
    session = default_session_manager.create_session(session_id, task_description, project_dir)
    return session


def continue_session():
    """List and select a session to continue."""
    sessions = default_session_manager.list_sessions()

    if not sessions:
        print("\n❌ 没有已保存的会话。")
        return None

    print("\n📋 已保存的会话:")
    print(f"{'#':>3} | {'ID':<10} | {'任务':<30} | {'项目':<20} | {'轮次':<5} | {'更新时间'}")
    print("-" * 95)
    for i, s in enumerate(sessions, 1):
        task = s["task_description"][:28] + ".." if len(s["task_description"]) > 30 else s["task_description"]
        proj = os.path.basename(s["project_dir"])
        updated = s.get("updated_at", "")[:16].replace("T", " ")
        print(f"{i:>3} | {s['session_id']:<10} | {task:<30} | {proj:<20} | {s['turns']:<5} | {updated}")

    print("\n选择要恢复的会话 (输入编号，或 0 取消):")
    choice = input("> ").strip()
    if not choice or choice == "0":
        return None

    try:
        idx = int(choice) - 1
        if idx < 0 or idx >= len(sessions):
            print("无效选择。")
            return None
        selected = sessions[idx]
        session = default_session_manager.load_session(selected["session_id"])
        if session is None:
            print("无法加载会话。")
            return None
        return session
    except (ValueError, IndexError):
        print("无效选择。")
        return None


def delete_session():
    """Delete a saved session."""
    sessions = default_session_manager.list_sessions()
    if not sessions:
        print("\n❌ 没有可删除的会话。")
        return

    print("\n🗑️  选择要删除的会话:")
    for i, s in enumerate(sessions, 1):
        print(f"  {i}. {s['session_id']} - {s['task_description'][:40]}")

    choice = input("\n输入编号 (或 0 取消): ").strip()
    if not choice or choice == "0":
        return

    try:
        idx = int(choice) - 1
        if idx < 0 or idx >= len(sessions):
            print("无效选择。")
            return
        selected = sessions[idx]
        confirm = input(f"确定删除会话 '{selected['session_id']}'? [y/N] ").strip().lower()
        if confirm in ("y", "yes"):
            default_session_manager.delete_session(selected["session_id"])
            print(f"✅ 已删除会话 '{selected['session_id']}'")
    except (ValueError, IndexError):
        print("无效选择。")


if __name__ == "__main__":
    session = start_new_session()
    if session:
        main_multiturn(session)