from pathlib import Path
import os

PROJECT_ROOT = Path(__file__).resolve().parents[0]
LOG_DIR = PROJECT_ROOT.parent / "logs"
SNAPSHOT_DIR = PROJECT_ROOT.parent / ".snapshots"
SESSIONS_DIR = PROJECT_ROOT.parent / "sessions"
API_PROVIDER = os.getenv("API_PROVIDER", "deepseek").lower()
USE_MOCK_CLAUDE = os.getenv("USE_MOCK_CLAUDE", "false").lower() in ("1", "true", "yes")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
CLAUDE_API_URL = os.getenv("CLAUDE_API_URL", "https://api.anthropic.com/v1/complete")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3.5")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")
DEEPSEEK_API_URL = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

DEFAULT_TIMEOUT = 60