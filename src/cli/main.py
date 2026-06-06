import os
from getpass import getpass

from ..config import API_PROVIDER, CLAUDE_API_KEY, DEEPSEEK_API_KEY, USE_MOCK_CLAUDE
from ..controller.orchestrator import Orchestrator
from ..logger import default_logger


def main():
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
    print(f"Claude AI Coding Agent - CLI MVP ({mode})")
    task = input("请描述你要执行的编程任务：\n>")
    orch = Orchestrator()
    try:
        orch.run_task(task)
    except Exception as e:
        default_logger.error("unhandled_exception", error=str(e))
        print("错误:", e)


if __name__ == "__main__":
    main()
