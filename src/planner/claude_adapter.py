import json
import os
import re
from typing import Any, Dict, List
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import time as _time
from ..config import (
    API_PROVIDER,
    CLAUDE_API_KEY,
    CLAUDE_API_URL,
    CLAUDE_MODEL,
    DEEPSEEK_API_KEY,
    DEEPSEEK_API_URL,
    DEEPSEEK_MODEL,
    USE_MOCK_CLAUDE,
)


class MockClaudeAdapter:
    """A richer mock adapter that returns structured plans based on simple heuristics."""
    def _make_file_edit(self, filename: str, content: str, desc: str = None) -> Dict:
        return {"type": "file_edit", "description": desc or f"Create or update {filename}", "files": [filename], "content": content, "danger_level": 0}
    def _make_command(self, command: str, desc: str | None = None, danger: int = 0) -> Dict:
        return {"type": "command", "description": desc or f"Run command: {command}", "command": command, "danger_level": danger}
    def _make_delete(self, path: str) -> Dict:
        return {"type": "file_edit", "description": f"Delete {path}", "files": [path], "content": None, "danger_level": 2, "operation": "delete"}
    def generate_plan(self, natural_language: str, context: Dict[str, Any] | None = None) -> Dict:
        nl = natural_language.strip()
        steps: List[Dict] = []
        if any(k in nl.lower() for k in ("test", "unit test", "pytest")):
            module = "example_generated.py"
            module_content = "# Auto-generated module\ndef greet(name: str) -> str:\n    return f'Hello, {name}'\n"
            test_content = "# Auto-generated test\nfrom example_generated import greet\n\ndef test_greet():\n    assert greet('World') == 'Hello, World'\n"
            steps.append(self._make_file_edit(module, module_content, desc="Create module with greet()"))
            steps.append(self._make_file_edit("test_example_generated.py", test_content, desc="Add unit test"))
            steps.append(self._make_command("pytest -q", desc="Run unit tests"))
        else:
            filename = "example_generated.py"
            content = f"# Generated file for task: {nl}\nprint('Hello from generated code')\n"
            steps.append(self._make_file_edit(filename, content))
            steps.append(self._make_command(f"python {filename}"))
        if any(k in nl.lower() for k in ("delete", "remove", "rm ")):
            steps.append(self._make_delete("old_backup.zip"))
        if any(k in nl.lower() for k in ("lint", "format", "black")):
            steps.append(self._make_command("python -m pip install black --quiet", desc="Install formatter", danger=1))
            steps.append(self._make_command("black --check .", desc="Check formatting"))
        return {"title": natural_language, "response": f"好的，我将为你的请求生成代码。共 {len(steps)} 个步骤。", "steps": steps}


class ClaudeAdapter:
    """Real Claude API adapter using Anthropic HTTP completion endpoint."""
    def __init__(self, api_key: str | None = None, api_url: str | None = None, model: str | None = None):
        self.api_key = api_key or CLAUDE_API_KEY or os.getenv("CLAUDE_API_KEY")
        if not self.api_key:
            raise RuntimeError("Claude API key is required for ClaudeAdapter. Set CLAUDE_API_KEY or enable mock mode via USE_MOCK_CLAUDE=true.")
        self.api_url = api_url or CLAUDE_API_URL
        self.model = model or CLAUDE_MODEL

    def generate_plan(self, natural_language: str, context: Dict[str, Any] | None = None) -> Dict:
        prompt = self._build_prompt(natural_language, context)
        completion = self._call_api(prompt)
        return self._parse_response(completion)

    def _build_prompt(self, task: str, context: Dict[str, Any] | None = None) -> str:
        base_prompt = (
            "You are a programming assistant. You help users with programming tasks by both chatting with them and executing file/command operations.\n\n"
            "For EVERY response, you MUST output valid JSON with this exact schema:\n"
            "{\n"
            "  \"title\": \"简短的任务标题\",\n"
            "  \"response\": \"你对用户的自然语言回复，友好简洁\",\n"
            "  \"steps\": [\n"
            "    {\n"
            "      \"type\": \"file_edit\",\n"
            "      \"description\": \"简短的操作说明\",\n"
            "      \"files\": [\"文件路径\"],\n"
            "      \"content\": \"修改后文件的完整内容（不是修改说明！）\",\n"
            "      \"danger_level\": 0\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "\n"
            "IMPORTANT RULES:\n"
            "1. The 'response' field MUST contain your natural language reply in Chinese.\n"
            "2. For 'file_edit' steps: 'content' MUST be the COMPLETE new file content, NOT just a description.\n"
            "3. If no changes are needed, return empty steps array.\n"
            "4. Output only valid parsable JSON, no extra text."
        )
        context_str = ""
        if context:
            if context.get("conversation_history"):
                context_str += f"\n\n## Previous conversation:\n{context['conversation_history']}"
            if context.get("file_snapshots"):
                context_str += "\n\n## Current file state:\n"
                for filepath, content in context["file_snapshots"].items():
                    context_str += f"\n### {filepath}:\n{content}\n"
        return base_prompt + context_str + f"\n\nCurrent request: {task}"

    def _call_api(self, prompt: str) -> str:
        payload = {"model": self.model, "prompt": f"Human: {prompt}\n\nAssistant:", "max_tokens_to_sample": 4096, "temperature": 0.0, "stop_sequences": ["\n\nHuman:"]}
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "x-api-key": self.api_key}
        request = Request(self.api_url, data=data, headers=headers, method="POST")
        try:
            with urlopen(request, timeout=60) as response:
                raw_body = response.read().decode("utf-8")
        except HTTPError as e:
            body = e.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"Claude API HTTP error {e.code}: {body}")
        except URLError as e:
            raise RuntimeError(f"Claude API request failed: {e.reason}")
        try:
            result = json.loads(raw_body)
        except json.JSONDecodeError:
            raise RuntimeError(f"Unable to decode Claude API response as JSON: {raw_body}")
        completion = result.get("completion") or result.get("output") or result.get("text")
        if isinstance(completion, dict):
            completion = completion.get("completion") or completion.get("output") or completion.get("text")
        if completion is None:
            raise RuntimeError(f"No completion field found in Claude response: {result}")
        return completion

    def _parse_response(self, text: str) -> Dict:
        return _parse_llm_json(text)


def _escape_content_value(raw: str) -> str:
    """Escape a string for JSON content field."""
    s = raw.replace('\\', '\\\\').replace('"', '\\"')
    s = s.replace('\n', '\\n').replace('\r', '\\n').replace('\t', '\\t')
    return s


def _find_content_end(text: str, start: int) -> int:
    """Find where a content field value ends by scanning character by character.
    
    The content value starts at 'start' (after the opening quote of content).
    It ends at the LAST quote that is followed by a structural marker like
    ', "danger_level"', ', "command"', etc.
    
    Returns the index of the closing quote (within text).
    """
    i = start
    while i < len(text):
        if text[i] == '"':
            rest = text[i:i+40]
            # Check if this quote ends the content value
            if re.match(r'"\s*,\s*"(?:danger_level|command|operation)"', rest):
                return i
            if re.match(r'"\s*,\s*\}', rest):
                return i
            if re.match(r'"\s*\}', rest):
                return i
        i += 1
    return len(text)


def _repair_json_content(text: str) -> str:
    """Repair the JSON by properly escaping ALL content field values.
    
    Uses a single-pass character-by-character approach to find and fix
    content values that contain unescaped characters.
    """
    result = ""
    i = 0
    
    while i < len(text):
        # Look for "content": "
        m = re.search(r'"content"\s*:\s*"', text[i:])
        if not m:
            result += text[i:]
            break
        
        # Copy everything up to and including the matched pattern
        match_end = i + m.end()
        result += text[i:match_end]
        
        # Find the end of this content value
        content_end = _find_content_end(text, match_end)
        
        # Extract and escape the content
        raw_content = text[match_end:content_end]
        escaped = _escape_content_value(raw_content)
        result += escaped
        result += '"'  # Add closing quote
        
        # Move past the closing quote
        # The closing quote is at content_end, so we continue from content_end + 1
        i = content_end + 1
    
    return result


def _parse_llm_json(text: str) -> Dict:
    """Parse JSON from LLM responses, handling unescaped characters in content fields."""
    # Strategy 1: try standard parsing
    try:
        start = text.find("{")
        if start >= 0:
            plan = json.loads(text[start:])
            if isinstance(plan, dict) and ("steps" in plan or "response" in plan):
                if "steps" not in plan:
                    plan["steps"] = []
                return plan
    except (json.JSONDecodeError, ValueError):
        pass

    # Strategy 2: repair content values and try again
    repaired = _repair_json_content(text)
    try:
        start = repaired.find("{")
        if start >= 0:
            plan = json.loads(repaired[start:])
            if isinstance(plan, dict) and ("steps" in plan or "response" in plan):
                if "steps" not in plan:
                    plan["steps"] = []
                # Unescape content back
                for s in plan.get("steps", []):
                    if isinstance(s, dict) and s.get("content"):
                        s["content"] = s["content"].replace('\\n', '\n').replace('\\t', '\t').replace('\\r', '\n')
                return plan
    except (json.JSONDecodeError, ValueError) as e:
        pass

    # Strategy 3: brute force field extraction using content as anchor
    result: Dict[str, Any] = {"title": "", "response": "", "steps": []}
    
    title_m = re.search(r'"title"\s*:\s*"([^"]*)"', text)
    if title_m:
        result["title"] = title_m.group(1)
    
    resp_m = re.search(r'"response"\s*:\s*"([^"]*)"', text)
    if resp_m:
        result["response"] = resp_m.group(1)
    
    # Find steps section
    steps_idx = text.find('"steps"')
    if steps_idx < 0:
        raise RuntimeError("No 'steps' array found")
    
    steps_section = text[steps_idx:]
    
    # Find all content fields - each one represents a step
    for content_m in re.finditer(r'"content"\s*:\s*"', steps_section):
        step: Dict[str, Any] = {"type": "file_edit", "danger_level": 0}
        
        # Get context before this content field
        ctx_start = max(0, content_m.start() - 400)
        ctx = steps_section[ctx_start:content_m.start()]
        
        # Extract simple fields
        tm = re.search(r'"type"\s*:\s*"([^"]+)"', ctx)
        if tm: step["type"] = tm.group(1)
        
        dm = re.search(r'"description"\s*:\s*"([^"]*)"', ctx)
        if dm: step["description"] = dm.group(1)
        
        fm = re.search(r'"files"\s*:\s*\[([^\]]*)\]', ctx)
        if fm:
            files = re.findall(r'"([^"]+)"', fm.group(1))
            if files: step["files"] = files
        
        # Extract content
        content_start = content_m.end()
        content_end = _find_content_end(steps_section, content_start)
        content = steps_section[content_start:content_end]
        step["content"] = content.replace('\\n', '\n').replace('\\t', '\t')
        
        result["steps"].append(step)
    
    if not result["steps"]:
        if not result.get("response"):
            raise RuntimeError("Could not extract any steps or response from the LLM output")
        # No steps but has a response - that's fine, just a conversational reply
    
    return result


class DeepseekAdapter:
    """Real Deepseek API adapter."""
    def __init__(self, api_key: str | None = None, api_url: str | None = None, model: str | None = None):
        self.api_key = api_key or DEEPSEEK_API_KEY or os.getenv("DEEPSEEK_API_KEY")
        if not self.api_key:
            raise RuntimeError("Deepseek API key is required. Set DEEPSEEK_API_KEY.")
        self.api_url = api_url or DEEPSEEK_API_URL
        self.model = model or DEEPSEEK_MODEL

    def generate_plan(self, natural_language: str, context: Dict[str, Any] | None = None) -> Dict:
        messages = self._build_messages(natural_language, context)
        completion = self._call_api(messages)
        return _parse_llm_json(completion)

    def _build_messages(self, task: str, context: Dict[str, Any] | None = None) -> List[Dict[str, str]]:
        system_prompt = (
            "You are a programming assistant. You help users with programming tasks by both chatting with them and executing file/command operations.\n\n"
            "For EVERY response, you MUST output valid JSON with this exact schema:\n"
            "{\n"
            "  \"title\": \"简短的任务标题\",\n"
            "  \"response\": \"你对用户的自然语言回复，友好、简洁，说明你做了什么或有什么问题\",\n"
            "  \"steps\": [\n"
            "    {\n"
            "      \"type\": \"file_edit\",\n"
            "      \"description\": \"简短的操作说明\",\n"
            "      \"files\": [\"文件路径\"],\n"
            "      \"content\": \"修改后文件的完整内容（不是修改说明，而是整个文件的新内容！）\",\n"
            "      \"danger_level\": 0\n"
            "    }\n"
            "  ]\n"
            "}\n"
            "\n"
            "IMPORTANT RULES:\n"
            "1. The 'response' field MUST contain your natural language reply to the user in Chinese.\n"
            "2. For 'file_edit' steps: 'content' MUST be the COMPLETE new file content, NOT just a description of changes. Include the entire file.\n"
            "3. For small changes (like deleting one line), still output the complete modified file in 'content'.\n"
            "4. If no changes are needed, return an empty steps array.\n"
            "5. Do NOT include any text outside the JSON block.\n"
            "6. Only output valid, parsable JSON."
        )
        user_content = task
        if context:
            if context.get("conversation_history"):
                user_content = f"## Previous conversation:\n{context['conversation_history']}\n\n" + user_content
            if context.get("file_snapshots"):
                file_info = "## Current file state:\n"
                for filepath, content in context["file_snapshots"].items():
                    file_info += f"\n### {filepath}:\n{content}\n"
                user_content = file_info + "\n" + user_content
        return [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_content}]

    def _call_api(self, messages: List[Dict[str, str]]) -> str:
        payload = {"model": self.model, "messages": messages, "temperature": 0.0, "max_tokens": 4096}
        data = json.dumps(payload).encode("utf-8")
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        request = Request(self.api_url, data=data, headers=headers, method="POST")
        max_retries = 3
        last_error = None
        for attempt in range(max_retries):
            try:
                with urlopen(request, timeout=60) as response:
                    raw_body = response.read().decode("utf-8")
                result = json.loads(raw_body)
                if not isinstance(result, dict):
                    raise RuntimeError(f"Unexpected Deepseek response format: {result}")
                if "choices" not in result or not result["choices"]:
                    raise RuntimeError(f"Deepseek response missing choices: {result}")
                first = result["choices"][0]
                message = first.get("message") or {}
                completion = message.get("content") or first.get("text")
                if completion is None:
                    raise RuntimeError(f"No completion in Deepseek response: {result}")
                return completion
            except json.JSONDecodeError:
                raise RuntimeError(f"Unable to decode Deepseek API response as JSON: {raw_body}")
            except HTTPError as e:
                body = e.read().decode("utf-8", errors="ignore")
                raise RuntimeError(f"Deepseek API HTTP error {e.code}: {body}")
            except URLError as e:
                last_error = e
                if attempt < max_retries - 1:
                    _time.sleep(2)
                    continue
                raise RuntimeError(f"Deepseek API request failed (after {max_retries} retries): {last_error.reason}")


def get_claude_adapter():
    api_key = os.getenv("DEEPSEEK_API_KEY") or os.getenv("CLAUDE_API_KEY") or ""
    provider = (os.getenv("API_PROVIDER") or "deepseek").lower()
    has_key = bool(api_key and len(api_key) > 10)
    if not has_key:
        raise RuntimeError(f"API key required. Provider '{provider}' but no valid key found.")
    if provider == "deepseek":
        return DeepseekAdapter(api_key=api_key)
    if provider == "claude":
        return ClaudeAdapter(api_key=api_key)
    raise RuntimeError(f"Unknown API provider '{provider}'.")