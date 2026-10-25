import re
from pathlib import Path
import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_DIR.parent

# Regex matching Unicode Emoji ranges (Dingbats, Emoticons, Pictographs, Transport, Misc)
EMOJI_PATTERN = re.compile(
    r"["
    r"\U0001F600-\U0001F64F"  # Emoticons
    r"\U0001F300-\U0001F5FF"  # Misc Symbols and Pictographs
    r"\U0001F680-\U0001F6FF"  # Transport and Map
    r"\U0001F1E0-\U0001F1FF"  # Flags
    r"\U0001F900-\U0001F9FF"  # Supplemental Symbols and Pictographs
    r"\U0001FA00-\U0001FA6F"  # Chess Symbols, Symbols and Pictographs Extended-A
    r"\U0001FA70-\U0001FAFF"  # Symbols and Pictographs Extended-A
    r"\u2600-\u26FF"          # Misc symbols
    r"\u2700-\u27BF"          # Dingbats
    r"\uFE0F"                 # Variation selector
    r"]",
    flags=re.UNICODE
)


def _scan_files_for_emojis(directory: Path, extensions: list[str]) -> list[str]:
    violations = []
    if not directory.exists():
        return violations

    for ext in extensions:
        for file_path in directory.rglob(f"*{ext}"):
            # Skip virtual environments, build artifacts, or cache folders
            if any(part in file_path.parts for part in (".venv", "node_modules", ".git", "__pycache__", ".next", "dist", "build")):
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
                lines = content.splitlines()
                for line_idx, line in enumerate(lines, start=1):
                    matches = EMOJI_PATTERN.findall(line)
                    if matches:
                        violations.append(
                            f"{file_path}:{line_idx} contains emoji {matches}: '{line.strip()}'"
                        )
            except Exception:
                pass
    return violations


def test_zero_emojis_in_backend_python_files():
    """Acceptance Criterion: Zero emojis anywhere in python source code, comments, or docstrings."""
    app_dir = BACKEND_DIR / "app"
    tests_dir = BACKEND_DIR / "tests"

    violations = _scan_files_for_emojis(app_dir, [".py"]) + _scan_files_for_emojis(tests_dir, [".py"])
    assert len(violations) == 0, (
        f"Found {len(violations)} emoji violation(s) in backend Python files:\n" + "\n".join(violations)
    )


def test_zero_emojis_in_frontend_files():
    """Acceptance Criterion: Zero emojis anywhere in frontend UI code, templates, or styles."""
    frontend_dir = PROJECT_ROOT / "frontend"
    if not frontend_dir.exists():
        pytest.skip("Frontend directory does not exist yet")

    violations = _scan_files_for_emojis(frontend_dir, [".ts", ".tsx", ".js", ".jsx", ".json", ".css", ".html"])
    assert len(violations) == 0, (
        f"Found {len(violations)} emoji violation(s) in frontend files:\n" + "\n".join(violations)
    )


def test_minimal_clean_inline_comments_in_backend():
    """Acceptance Criterion: Clean code with minimal, non-redundant inline comments."""
    app_dir = BACKEND_DIR / "app"
    if not app_dir.exists():
        return

    # Prohibit noisy placeholder comments like 'TODO: implement' or redundant comments
    noisy_patterns = [
        re.compile(r"#\s*TODO\s*implement", re.IGNORECASE),
        re.compile(r"#\s*this function", re.IGNORECASE),
    ]

    noisy_matches = []
    for file_path in app_dir.rglob("*.py"):
        if "__pycache__" in file_path.parts:
            continue
        try:
            content = file_path.read_text(encoding="utf-8")
            for line_idx, line in enumerate(content.splitlines(), start=1):
                for pat in noisy_patterns:
                    if pat.search(line):
                        noisy_matches.append(f"{file_path}:{line_idx}: {line.strip()}")
        except Exception:
            pass

    assert len(noisy_matches) == 0, (
        f"Found noisy/uninformative comments:\n" + "\n".join(noisy_matches)
    )
