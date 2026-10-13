import re
from typing import Any, Union

PROMPT_INJECTION_TOKENS = [
    r"<\|im_start\|>",
    r"<\|im_end\|>",
    r"\[INST\]",
    r"\[/INST\]",
    r"<<SYS>>",
    r"<</SYS>>",
    r"<s>",
    r"</s>",
    r"<\|system\|>",
    r"<\|user\|>",
    r"<\|assistant\|>",
    r"<\|endoftext\|>",
]

CODE_FENCE_SYSTEM_REGEX = re.compile(
    r"```(?:json)?\s*\{[^}]*\"(?:system|role|superuser|override)\"[^}]*\}\s*```",
    re.IGNORECASE | re.DOTALL,
)

OVERRIDE_KEYWORDS_REGEX = re.compile(
    r"(?:system\s+prompt\s+override|ignore\s+all\s+previous\s+rules|"
    r"ignore\s+previous\s+instructions|dump\s+secret\s+passwords|"
    r"reveal\s+master\s+api\s+keys|print\s+internal\s+server\s+config)",
    re.IGNORECASE,
)

SENSITIVE_KEYWORD_REGEX = re.compile(
    r"\b(?:api_key|api\s+keys?|master\s+api\s+key|internal\s+server\s+config|password|passwd|secret)\b",
    re.IGNORECASE,
)

PATH_LEAK_REGEX = re.compile(
    r"(?:[a-zA-Z]:[\\/]|/(?:app|home|usr|var|tmp|etc|opt))[^\s:,\"]+",
    re.IGNORECASE,
)

SENSITIVE_ERROR_WORDS_REGEX = re.compile(
    r"\b(?:catastrophic|secrets\.py|password|traceback)\b",
    re.IGNORECASE,
)


def strip_prompt_injection_delimiters(text: str) -> str:
    cleaned = CODE_FENCE_SYSTEM_REGEX.sub("", text)
    for pattern in PROMPT_INJECTION_TOKENS:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
    cleaned = OVERRIDE_KEYWORDS_REGEX.sub("", cleaned)
    return cleaned.strip()


def sanitize_prompt_input(text: str) -> str:
    cleaned = strip_prompt_injection_delimiters(text)
    cleaned = SENSITIVE_KEYWORD_REGEX.sub("[FILTERED]", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def sanitize_error_detail(err: Union[Exception, str, Any]) -> dict:
    text = str(err)
    cleaned = PATH_LEAK_REGEX.sub("[REDACTED_PATH]", text)
    cleaned = SENSITIVE_ERROR_WORDS_REGEX.sub("[REDACTED]", cleaned)
    cleaned = re.sub(r"line\s+\d+", "line [REDACTED]", cleaned, flags=re.IGNORECASE)
    return {
        "detail": "Internal server error occurred",
        "error_code": "INTERNAL_SERVER_ERROR",
        "sanitized_message": cleaned,
    }
