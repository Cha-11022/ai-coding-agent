"""File diff/patch manager for incremental modifications."""

import re
from typing import Dict, List, Optional, Tuple


class FileDiff:
    """Represents a diff operation on a file."""

    def __init__(self, filepath: str, operation: str, content: Optional[str] = None, line_num: Optional[int] = None):
        self.filepath = filepath
        self.operation = operation  # "create", "append", "replace", "insert_after", "delete_lines"
        self.content = content
        self.line_num = line_num  # For insert_after, replace, delete_lines operations


class FileDiffParser:
    """Parse AI responses to extract incremental file modifications."""

    @staticmethod
    def parse_diffs_from_response(response_text: str) -> List[FileDiff]:
        """
        Extract file diffs from AI response text.
        Expected formats:
        - "CREATE: path/file.py\n<content>"
        - "APPEND: path/file.py\n<content>"
        - "INSERT_AFTER: path/file.py:42\n<content>"
        - "REPLACE: path/file.py:10-15\n<content>"
        - "DELETE: path/file.py:5-8"
        """
        diffs = []
        lines = response_text.split("\n")
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Match diff command pattern
            match = re.match(r"(CREATE|APPEND|INSERT_AFTER|REPLACE|DELETE):\s*(.+?)(?::(\d+)(?:-(\d+))?)?$", line, re.IGNORECASE)
            if match:
                op = match.group(1).upper()
                filepath = match.group(2).strip()
                start_line = int(match.group(3)) if match.group(3) else None
                end_line = int(match.group(4)) if match.group(4) else None
                
                # Collect content until next command or EOF
                i += 1
                content_lines = []
                while i < len(lines):
                    if re.match(r"(CREATE|APPEND|INSERT_AFTER|REPLACE|DELETE):\s*", lines[i], re.IGNORECASE):
                        break
                    content_lines.append(lines[i])
                    i += 1
                
                content = "\n".join(content_lines).rstrip()
                
                diff = FileDiff(
                    filepath=filepath,
                    operation=op,
                    content=content if op != "DELETE" else None,
                    line_num=start_line
                )
                diffs.append(diff)
                continue
            
            i += 1
        
        return diffs


class FileModifier:
    """Apply diffs to actual files."""

    @staticmethod
    def apply_diff(filepath: str, content: str, diff: FileDiff) -> str:
        """
        Apply a single diff to file content and return the modified content.
        """
        lines = content.split("\n") if content else []
        
        if diff.operation == "CREATE":
            return diff.content or ""
        
        elif diff.operation == "APPEND":
            if content and not content.endswith("\n"):
                return content + "\n" + (diff.content or "")
            return content + (diff.content or "")
        
        elif diff.operation == "INSERT_AFTER":
            if diff.line_num is None:
                raise ValueError("INSERT_AFTER requires line_num")
            # Insert after line N means insert at position N (0-indexed)
            insert_pos = diff.line_num
            if insert_pos < 0 or insert_pos > len(lines):
                raise ValueError(f"Insert position {insert_pos} out of range for {len(lines)} lines")
            
            new_lines = lines[:insert_pos] + (diff.content or "").split("\n") + lines[insert_pos:]
            return "\n".join(new_lines)
        
        elif diff.operation == "REPLACE":
            if diff.line_num is None:
                raise ValueError("REPLACE requires line_num")
            start_line = diff.line_num - 1  # Convert to 0-indexed
            end_line = diff.line_num  # Replace just one line by default
            
            if start_line < 0 or start_line >= len(lines):
                raise ValueError(f"Replace position {start_line} out of range")
            
            new_lines = lines[:start_line] + (diff.content or "").split("\n") + lines[end_line:]
            return "\n".join(new_lines)
        
        elif diff.operation == "DELETE_LINES":
            if diff.line_num is None:
                raise ValueError("DELETE_LINES requires line_num")
            start_line = diff.line_num - 1
            # For now, delete just one line
            if start_line < 0 or start_line >= len(lines):
                raise ValueError(f"Delete position {start_line} out of range")
            
            new_lines = lines[:start_line] + lines[start_line + 1:]
            return "\n".join(new_lines)
        
        else:
            raise ValueError(f"Unknown operation: {diff.operation}")
    
    @staticmethod
    def apply_diffs(file_contents: Dict[str, str], diffs: List[FileDiff]) -> Dict[str, str]:
        """
        Apply multiple diffs to a set of files.
        Returns updated file contents.
        """
        modified = file_contents.copy()
        
        for diff in diffs:
            current_content = modified.get(diff.filepath, "")
            try:
                modified[diff.filepath] = FileModifier.apply_diff(diff.filepath, current_content, diff)
            except Exception as e:
                # Log error but continue with other diffs
                print(f"Warning: Failed to apply diff to {diff.filepath}: {e}")
        
        return modified
