"""PostgreSQL не допускает NUL (0x00) в типах text/varchar."""


def sanitize_postgres_text(s: str) -> str:
    if "\x00" not in s:
        return s
    return s.replace("\x00", "")
